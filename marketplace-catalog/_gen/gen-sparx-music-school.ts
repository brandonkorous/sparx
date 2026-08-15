// sparx-music-school — "Crescendo Music School", a warm community music school.
//
// The encouraging, all-ages neighbourhood school of the research: private lessons in
// piano, guitar, voice, violin and drums, group musicianship classes and recitals, for
// children and adults alike. A rich burgundy primary, a warm-gold accent, a soft cream
// ground and a humanist serif display over Inter — joyful, classical-friendly, never
// intimidating. Deliberately the WARM, all-ages, classical-leaning sibling of the modern
// contemporary-lessons studio template — same booking spine, a different school. The
// functional core is BOOKING A TRIAL LESSON: a real menu of lessons + classes, teachers
// you book by name (matched with a lesson room), and a no-show policy.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-music-school.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-music-school/**" \
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
  hero: 'music-school-hero',
  studio: 'music-school-studio',
  mara: 'music-school-mara',
  theo: 'music-school-theo',
  lena: 'music-school-lena',
} as const;

const PHOTO: Record<string, string> = {
  "crescendo-hero": "https://images.unsplash.com/photo-1552422535-c45813c61732?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2hpbGQlMjBwaWFubyUyMGxlc3NvbnxlbnwwfDB8fHwxNzg2MzkxNTI0fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "crescendo-studio": "https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bXVzaWMlMjBsZXNzb24lMjByb29tJTIwcGlhbm98ZW58MHwwfHx8MTc4NjM5MTUyOHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "crescendo-mara": "https://images.unsplash.com/photo-1573496799652-408c2ac9fe98?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjBtdXNpYyUyMHRlYWNoZXIlMjBwb3J0cmFpdHxlbnwwfDB8fHwxNzg2MzkxNTMxfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "crescendo-theo": "https://images.unsplash.com/photo-1636581563713-5ead3fb53a80?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bXVzaWMlMjB0ZWFjaGVyJTIwcG9ydHJhaXQlMjBtYW58ZW58MHwwfHx8MTc4NjM5MTUzM3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "crescendo-lena": "https://images.unsplash.com/photo-1725215956940-91f616b95443?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dmlvbGluJTIwdGVhY2hlciUyMHBvcnRyYWl0fGVufDB8MHx8fDE3ODYzOTE1Mzd8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
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
    url: src('crescendo-hero'),
    alt: 'A young student smiling at the piano during a lesson',
  },
  {
    id: IMG.studio,
    url: src('crescendo-studio'),
    alt: 'A warm, light-filled lesson room with an upright piano and music stands',
  },
  { id: IMG.mara, url: src('crescendo-mara'), alt: 'Mara Ellison, piano and voice teacher' },
  { id: IMG.theo, url: src('crescendo-theo'), alt: 'Theo Nakamura, guitar teacher' },
  { id: IMG.lena, url: src('crescendo-lena'), alt: 'Lena Petrov, violin teacher' },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-music-school: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "crescendo": cream ground, burgundy primary, warm-gold accent, serif display ─
const crescendo = defineTheme({
  name: 'crescendo',
  type: { body: face('Inter', 'sans-serif'), head: face('Fraunces', 'serif') },
  shape: { selector: '0.75rem', field: '0.625rem', box: '1rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(97% 0.012 90)', // soft cream
      'oklch(94% 0.016 88)', // warm oat
      'oklch(89% 0.02 85)', // hairline
      'oklch(25% 0.02 25)', // warm dark ink
    ],
    roles: {
      primary: 'oklch(42% 0.13 18)', // warm burgundy
      secondary: 'oklch(38% 0.03 22)', // dark warm — readable micro-labels on cream
      accent: 'oklch(76% 0.12 80)', // warm gold
      neutral: 'oklch(28% 0.02 25)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(22% 0.02 20)',
      'oklch(18% 0.018 20)',
      'oklch(14% 0.014 20)',
      'oklch(95% 0.01 90)',
    ],
    roles: {
      primary: 'oklch(70% 0.11 22)',
      secondary: 'oklch(80% 0.02 80)',
      accent: 'oklch(82% 0.12 82)',
      neutral: 'oklch(84% 0.015 80)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the booking spine (policies, teachers + rooms, the lesson menu) ───────
const hours = (days: number[], startMinute: number, endMinute: number) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

const SCHEDULING = {
  policies: [
    {
      handle: 'lesson-standard',
      name: 'Standard lesson',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [1440, 120],
      policyText:
        'Please give us at least 24 hours’ notice to reschedule or cancel a lesson. We send a reminder the day before and two hours ahead so nobody forgets.',
    },
    {
      handle: 'no-show',
      name: 'Missed lesson',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [1440, 120],
      policyText:
        'Lessons cancelled with less than 24 hours’ notice, or missed without warning, are counted as used. Life happens — just let your teacher know as early as you can and we’ll do our best to find another time.',
    },
  ],
  resources: [
    {
      handle: 'mara',
      name: 'Mara Ellison',
      kind: 'staff',
      skillTags: ['piano', 'voice', 'theory'],
      windows: hours([1, 2, 3, 4], 900, 1200).concat(hours([6], 540, 780)), // Mon–Thu 3–8pm, Sat 9am–1pm
    },
    {
      handle: 'theo',
      name: 'Theo Nakamura',
      kind: 'staff',
      skillTags: ['guitar', 'bass', 'ukulele'],
      windows: hours([2, 3, 4, 5], 900, 1200).concat(hours([6], 600, 840)), // Tue–Fri 3–8pm, Sat 10am–2pm
    },
    {
      handle: 'lena',
      name: 'Lena Petrov',
      kind: 'staff',
      skillTags: ['violin', 'viola', 'strings', 'theory'],
      windows: hours([1, 3, 4], 900, 1200).concat(hours([0], 600, 840)), // Mon, Wed, Thu 3–8pm, Sun 10am–2pm
    },
    {
      handle: 'room-a',
      name: 'Studio A',
      kind: 'space',
      skillTags: ['lesson-room'],
      windows: hours([1, 2, 3, 4, 5, 6, 0], 540, 1200), // every day 9am–8pm
    },
    {
      handle: 'room-b',
      name: 'Studio B',
      kind: 'space',
      skillTags: ['lesson-room'],
      windows: hours([1, 2, 3, 4, 5, 6, 0], 540, 1200), // every day 9am–8pm
    },
  ],
  services: [
    {
      handle: 'trial-lesson',
      name: 'Trial lesson',
      description:
        'A free, no-pressure first lesson — meet a teacher, try your instrument and see if we’re the right fit. All ages, all levels welcome.',
      durationMinutes: 30,
      priceCents: 0,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'teacher', kind: 'staff', skillTags: ['piano'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['lesson-room'], count: 1 },
      ],
      policyHandle: 'lesson-standard',
    },
    {
      handle: 'piano-lesson',
      name: 'Piano lesson',
      description:
        'One-to-one piano for beginners through advanced — from first notes and reading music to pieces you’ve always wanted to play.',
      durationMinutes: 45,
      priceCents: 6000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'teacher', kind: 'staff', skillTags: ['piano'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['lesson-room'], count: 1 },
      ],
      policyHandle: 'lesson-standard',
    },
    {
      handle: 'guitar-lesson',
      name: 'Guitar lesson',
      description:
        'Acoustic or electric, chords to solos — a private guitar lesson built around the music you love to play.',
      durationMinutes: 45,
      priceCents: 5500,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'teacher', kind: 'staff', skillTags: ['guitar'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['lesson-room'], count: 1 },
      ],
      policyHandle: 'lesson-standard',
    },
    {
      handle: 'voice-lesson',
      name: 'Voice lesson',
      description:
        'Find your voice with gentle, healthy technique — breathing, range and songs, at whatever pace feels right for you.',
      durationMinutes: 45,
      priceCents: 6000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'teacher', kind: 'staff', skillTags: ['voice'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['lesson-room'], count: 1 },
      ],
      policyHandle: 'lesson-standard',
    },
    {
      handle: 'violin-lesson',
      name: 'Violin lesson',
      description:
        'Private violin from the very first day — posture, tone and technique, with a warm, patient teacher beside you.',
      durationMinutes: 45,
      priceCents: 6000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'teacher', kind: 'staff', skillTags: ['violin'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['lesson-room'], count: 1 },
      ],
      policyHandle: 'lesson-standard',
    },
    {
      handle: 'group-musicianship-class',
      name: 'Group musicianship class',
      description:
        'A joyful small-group class — rhythm, ear-training and playing together. The fun, social side of learning music.',
      durationMinutes: 60,
      priceCents: 3000,
      bookingType: 'class',
      capacity: 8,
      assignmentStrategy: 'collective',
      resourceRequirements: [
        { role: 'teacher', kind: 'staff', skillTags: ['theory'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['lesson-room'], count: 1 },
      ],
      policyHandle: 'lesson-standard',
    },
    {
      handle: 'recital-prep-lesson',
      name: 'Recital prep lesson',
      description:
        'A focused, hour-long session to polish your piece and steady your nerves before a recital or exam.',
      durationMinutes: 60,
      priceCents: 7500,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'teacher', kind: 'staff', skillTags: ['piano'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['lesson-room'], count: 1 },
      ],
      policyHandle: 'lesson-standard',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  photoHero({
    image: url(IMG.hero),
    alt: 'A young student smiling at the piano during a lesson',
    title: 'Learn to love making music',
    sub: 'Warm, encouraging private lessons and group classes in piano, guitar, voice, violin and more — for every age and every level. Start with a free trial lesson.',
    primary: { label: 'Book a trial lesson', href: '/book' },
    secondary: { label: 'See lessons & classes', href: '/book' },
    overlay: 'dark',
  }),
  featureRow({
    items: [
      {
        title: 'Caring, certified teachers',
        body: 'Real musicians who love to teach — patient, encouraging, and trained to meet you exactly where you are.',
      },
      {
        title: 'All ages, all instruments',
        body: 'From four-year-olds at their first keyboard to grandparents picking up guitar — beginners are genuinely welcome here.',
      },
      {
        title: 'Recitals & performances',
        body: 'Friendly, low-pressure recitals give every student something to work toward and a moment to feel proud.',
      },
      {
        title: 'Flexible scheduling',
        body: 'After-school and weekend times, easy online booking, and reminders so lessons fit around real family life.',
      },
    ],
  }),
  serviceMenu({
    heading: 'Lessons & classes',
    intro: 'A few of the ways to make music with us. See full prices and live times on the booking page — and remember, your first lesson is free.',
    surface: 'muted',
    columns: 2,
    items: [
      {
        name: 'Trial lesson',
        priceCents: 0,
        durationMin: 30,
        desc: 'A free first lesson — meet a teacher and try it out.',
      },
      {
        name: 'Piano lesson',
        priceCents: 6000,
        durationMin: 45,
        desc: 'One-to-one piano for every level.',
      },
      {
        name: 'Guitar lesson',
        priceCents: 5500,
        durationMin: 45,
        desc: 'Acoustic or electric, chords to solos.',
      },
      {
        name: 'Group musicianship class',
        priceCents: 3000,
        durationMin: 60,
        desc: 'Rhythm, ear-training and playing together.',
      },
    ],
    cta: { label: 'See everything & book', href: '/book' },
  }),
  splitFeature({
    image: url(IMG.studio),
    alt: 'A warm, light-filled lesson room with an upright piano and music stands',
    heading: 'Music should feel joyful, not stressful',
    body: [
      'We believe every person is musical, and that the fastest way to grow is to enjoy the journey. So we teach with encouragement first — celebrating small wins, choosing songs students actually want to play, and never making anyone feel behind.',
      'Progress is personal here. Whether you dream of playing in a recital or just want a happy half-hour each week, your teacher builds the lessons around you.',
    ],
    cta: { label: 'Book a trial lesson', href: '/book' },
  }),
  teamRow({
    heading: 'Meet your teachers',
    intro: 'Book by name — you’ll learn with the same teacher each week, someone who gets to know you and how you like to learn.',
    members: [
      {
        name: 'Mara Ellison',
        role: 'Piano & voice',
        image: url(IMG.mara),
        alt: 'Mara Ellison, piano and voice teacher',
        bio: 'Twenty years of teaching, endless patience, and a gift for making beginners feel at home at the keyboard.',
      },
      {
        name: 'Theo Nakamura',
        role: 'Guitar',
        image: url(IMG.theo),
        alt: 'Theo Nakamura, guitar teacher',
        bio: 'From first chords to full songs, Theo meets every student where they are — teens and grown-up beginners especially love his classes.',
      },
      {
        name: 'Lena Petrov',
        role: 'Violin & strings',
        image: url(IMG.lena),
        alt: 'Lena Petrov, violin teacher',
        bio: 'A warm, encouraging strings teacher who makes the violin approachable for the very youngest players and returning adults alike.',
      },
    ],
  }),
  testimonial({
    quote: 'My daughter counts down the days to her piano lesson. She’s learning so much, but more than that, she’s fallen in love with music. That’s everything we hoped for.',
    attribution: 'Rachel, parent of a Crescendo student',
  }),
  bookingCta({
    title: 'Ready to make some music?',
    sub: 'Pick an instrument, choose your teacher and see live times. Your first lesson is free — it takes about a minute to book.',
    cta: { label: 'Book a trial lesson', href: '/book' },
  }),
];

const BOOK_INTRO = [
  photoHero({
    image: url(IMG.studio),
    alt: 'A warm, light-filled lesson room with an upright piano and music stands',
    title: 'Book your lesson',
    sub: 'Choose a lesson or class to see prices and live availability, then pick your teacher and time. First lesson’s on us.',
    primary: { label: 'See lessons below', href: '/book' },
    overlay: 'darker',
    align: 'start',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.hero),
    alt: 'A young student smiling at the piano during a lesson',
    heading: 'About Crescendo Music School',
    body: [
      'Crescendo began with a simple belief: that everyone deserves the joy of making music, and that the right teacher can change a life. We opened our doors as a neighbourhood school where children and adults, absolute beginners and returning players, all feel equally welcome.',
      'Today we’re a small, close-knit school of teachers who genuinely love what they do — and a community of students, families and friends who cheer each other on at every recital.',
    ],
    cta: { label: 'Book a trial lesson', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'What we believe',
    items: [
      {
        title: 'Everyone is musical',
        body: 'There’s no such thing as “not musical” — only music not yet discovered. We teach with that faith in every student.',
      },
      {
        title: 'Encouragement first',
        body: 'We lead with warmth and small wins. Confidence is what keeps people playing, so we build it from the very first lesson.',
      },
      {
        title: 'A place to belong',
        body: 'Recitals, group classes and a friendly front desk make Crescendo a community, not just a place you take lessons.',
      },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Visit the school',
    address: ['Crescendo Music School', '215 Maple Row', 'Suite 3 · Asheville, NC 28801'],
    mapLocation: '215 Maple Row, Asheville, NC 28801',
    hours: [
      { day: 'Monday – Thursday', time: '3:00 – 8:00' },
      { day: 'Friday', time: '3:00 – 8:00' },
      { day: 'Saturday', time: '9:00 – 2:00' },
      { day: 'Sunday', time: '10:00 – 2:00' },
    ],
  }),
  bookingCta({
    title: 'Rather book than call?',
    sub: 'See live availability and reserve your free trial lesson online — no phone tag.',
    surface: 'muted',
    cta: { label: 'Book a trial lesson', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-music-school',
  name: 'Music School',
  summary:
    'A warm, all-ages music-school site — a cream palette, a burgundy primary and a friendly serif display — with online booking for free trial lessons from day one. Installs a working booking flow: a real menu of private lessons (piano, guitar, voice, violin) and a group class, three teachers you book by name matched with a lesson room, and a no-show policy. Ships as "Crescendo Music School", an encouraging community school for every age and level.',
  tagline: 'A warm, joyful template for music schools — book trial lessons online from day one.',
  industry: 'Music lessons',
  sortWeight: 50,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'Crescendo Music School', tagline: 'Learn to love making music.' },
  theme: crescendo,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Crescendo Music School — lessons for every age',
      description:
        'Crescendo Music School offers warm, encouraging lessons in piano, guitar, voice and violin for all ages and levels. Book a free trial lesson online.',
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
