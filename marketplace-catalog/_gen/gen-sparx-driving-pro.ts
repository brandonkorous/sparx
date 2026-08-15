// sparx-driving-pro — "Apex Driving Academy", a professional adult & advanced DRIVING ACADEMY.
//
// The confident, skill-focused sibling of the teen driver's-ed template: adult lessons,
// defensive driving, anxious/nervous-driver coaching, senior refreshers, advanced highway
// skills and license transfers. A sharp modern look — a deep navy primary, an electric
// amber accent, a crisp near-white ground and confident modern-sans display — deliberately
// the OPPOSITE of the friendly teen school (bright, playful). Same booking spine, a
// different business: the functional core is "Book a lesson", and the scheduling menu
// routes each behind-the-wheel service to an INSTRUCTOR plus a TRAINING CAR (a bookable
// `asset`), while an assessment/consult needs the instructor only.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-driving-pro.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-driving-pro/**" \
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
  serviceMenu,
  splitFeature,
  STATUS_ON_DARK,
  STATUS_ON_LIGHT,
  teamRow,
  testimonial,
  typeHero,
  type ServiceSiteSpec,
} from './service-sites/harness';

// ── Imagery (swap-ready; each id also names an entry in ASSETS) ────────────────────
const IMG = {
  method: 'driving-pro-method',
  about: 'driving-pro-about',
  ricardo: 'driving-pro-ricardo',
  dana: 'driving-pro-dana',
  theo: 'driving-pro-theo',
} as const;

const PHOTO: Record<string, string> = {
  "apexdrive-method": "https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGVyc29uJTIwZHJpdmluZyUyMGNhcnxlbnwwfDB8fHwxNzg2Mzk0MjUxfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "apexdrive-about": "https://images.unsplash.com/photo-1527593167147-e9c94a5883e6?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2FyJTIwc3RlZXJpbmclMjB3aGVlbCUyMGRyaXZpbmd8ZW58MHwwfHx8MTc4NjM5NDI1NHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "apexdrive-ricardo": "https://images.unsplash.com/photo-1623366302587-b38b1ddaefd9?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8aW5zdHJ1Y3RvciUyMHBvcnRyYWl0JTIwbWFufGVufDB8MHx8fDE3ODYzOTQyNTd8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "apexdrive-dana": "https://images.unsplash.com/photo-1506863530036-1efeddceb993?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjBpbnN0cnVjdG9yJTIwcG9ydHJhaXR8ZW58MHwwfHx8MTc4NjM5NDI0Mnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "apexdrive-theo": "https://images.unsplash.com/photo-1676989880361-091e12efc056?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cHJvZmVzc2lvbmFsJTIwbWFuJTIwcG9ydHJhaXR8ZW58MHwwfHx8MTc4NjM4NzQxMHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
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
    id: IMG.method,
    url: src('apexdrive-method'),
    alt: 'An instructor coaching an adult learner from the passenger seat on a city street',
  },
  {
    id: IMG.about,
    url: src('apexdrive-about'),
    alt: 'A dual-control training car on a quiet residential road at golden hour',
  },
  {
    id: IMG.ricardo,
    url: src('apexdrive-ricardo'),
    alt: 'Ricardo Vega, lead defensive-driving instructor',
  },
  {
    id: IMG.dana,
    url: src('apexdrive-dana'),
    alt: 'Dana Whitfield, anxious-driver coach',
  },
  {
    id: IMG.theo,
    url: src('apexdrive-theo'),
    alt: 'Theo Marsh, advanced & highway instructor',
  },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-driving-pro: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "apexdrive": deep-navy primary, electric-amber accent, crisp near-white ground ─
const apexdrive = defineTheme({
  name: 'apexdrive',
  type: { body: face('Inter', 'sans-serif'), head: face('Space Grotesk', 'sans-serif') },
  shape: { selector: '0.25rem', field: '0.25rem', box: '0.375rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(98% 0.004 250)', // crisp near-white ground
      'oklch(95% 0.006 255)', // cool pale
      'oklch(90% 0.01 258)', // hairline
      'oklch(22% 0.035 265)', // deep ink navy text
    ],
    roles: {
      primary: 'oklch(34% 0.095 264)', // deep navy
      secondary: 'oklch(40% 0.03 262)', // dark charcoal — readable micro-labels on light
      accent: 'oklch(74% 0.16 66)', // electric amber
      neutral: 'oklch(26% 0.025 265)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(20% 0.03 265)', // deep navy-charcoal
      'oklch(16% 0.028 266)',
      'oklch(13% 0.022 266)',
      'oklch(96% 0.005 250)', // near-white ink
    ],
    roles: {
      primary: 'oklch(70% 0.12 260)', // lifted blue for dark ground
      secondary: 'oklch(74% 0.025 260)',
      accent: 'oklch(80% 0.15 68)', // amber
      neutral: 'oklch(82% 0.02 260)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the booking spine (policies, instructors + training cars, the menu) ───
const hours = (days: number[], startMinute: number, endMinute: number) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

const behindTheWheel = (instructorTag: string) => [
  { role: 'instructor', kind: 'staff', skillTags: [instructorTag], count: 1 },
  { role: 'car', kind: 'asset', skillTags: ['training-car'], count: 1 },
];

const SCHEDULING = {
  policies: [
    {
      handle: 'lesson-standard',
      name: 'Standard booking',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [1440, 120],
      policyText:
        'Please give us at least 24 hours’ notice to reschedule or cancel. We send a reminder the day before and two hours ahead so you’re never caught out.',
    },
    {
      handle: 'no-show',
      name: 'No-show policy',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [1440, 120],
      policyText:
        'A missed lesson with no notice, or a cancellation inside 24 hours, is charged in full — the car and instructor were held for you. Life happens, so tell us as early as you can and we’ll always try to move you instead.',
    },
  ],
  resources: [
    {
      handle: 'ricardo',
      name: 'Ricardo Vega',
      kind: 'staff',
      skillTags: ['adult', 'defensive', 'general'],
      windows: hours([1, 2, 3, 4, 5], 480, 1020), // Mon–Fri 8–5
    },
    {
      handle: 'dana',
      name: 'Dana Whitfield',
      kind: 'staff',
      skillTags: ['anxiety', 'adult', 'general'],
      windows: hours([2, 3, 4, 5, 6], 540, 1080), // Tue–Sat 9–6
    },
    {
      handle: 'theo',
      name: 'Theo Marsh',
      kind: 'staff',
      skillTags: ['advanced', 'highway', 'general'],
      windows: hours([3, 4, 5, 6, 0], 600, 1140), // Wed–Sun 10–7
    },
    {
      handle: 'car-1',
      name: 'Training car 1 — dual-control sedan',
      kind: 'asset',
      skillTags: ['training-car'],
      windows: hours([1, 2, 3, 4, 5, 6], 480, 1140), // Mon–Sat 8–7
    },
    {
      handle: 'car-2',
      name: 'Training car 2 — dual-control hatchback',
      kind: 'asset',
      skillTags: ['training-car'],
      windows: hours([2, 3, 4, 5, 6, 0], 540, 1140), // Tue–Sun 9–7
    },
  ],
  services: [
    {
      handle: 'driving-assessment',
      name: 'Driving assessment & plan',
      description:
        'A no-pressure sit-down and short drive so we can see where you’re at and map the exact lessons you need. Free, and there’s no obligation to book more.',
      durationMinutes: 45,
      priceCents: 0,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'instructor', kind: 'staff', skillTags: ['general'], count: 1 },
      ],
      policyHandle: 'lesson-standard',
    },
    {
      handle: 'adult-lesson',
      name: 'Adult driving lesson',
      description:
        'A focused hour behind the wheel for adult learners — building real road confidence at your pace, in a calm dual-control car.',
      durationMinutes: 60,
      priceCents: 8500,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: behindTheWheel('adult'),
      policyHandle: 'lesson-standard',
    },
    {
      handle: 'defensive-driving-course',
      name: 'Defensive driving session',
      description:
        'Hazard awareness, space management and crash-avoidance technique — the skills that keep you safe long after the test. Great for a ticket dismissal or an insurance discount.',
      durationMinutes: 90,
      priceCents: 13500,
      bufferAfterMin: 10,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: behindTheWheel('defensive'),
      policyHandle: 'lesson-standard',
    },
    {
      handle: 'anxious-driver-session',
      name: 'Nervous-driver coaching',
      description:
        'For anyone who’s put driving off or lost their nerve. A patient, judgement-free hour that starts exactly where you’re comfortable and grows from there.',
      durationMinutes: 60,
      priceCents: 9500,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: behindTheWheel('anxiety'),
      policyHandle: 'lesson-standard',
    },
    {
      handle: 'senior-refresher',
      name: 'Senior refresher lesson',
      description:
        'A relaxed check-in and tune-up for experienced drivers who want to stay sharp and independent, with honest, respectful feedback.',
      durationMinutes: 60,
      priceCents: 8500,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: behindTheWheel('adult'),
      policyHandle: 'lesson-standard',
    },
    {
      handle: 'advanced-highway-lesson',
      name: 'Advanced & highway lesson',
      description:
        'Merging, lane discipline, high-speed judgement and complex interchanges — the confidence to take on freeways and long trips.',
      durationMinutes: 120,
      priceCents: 16500,
      bufferAfterMin: 15,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: behindTheWheel('advanced'),
      policyHandle: 'lesson-standard',
    },
    {
      handle: 'license-transfer-lesson',
      name: 'License-transfer lesson',
      description:
        'New to the state or the country? A targeted session on local road rules and habits so you pass the transfer test the first time.',
      durationMinutes: 90,
      priceCents: 12500,
      bufferAfterMin: 10,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: behindTheWheel('adult'),
      policyHandle: 'lesson-standard',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  typeHero({
    title: 'Drive like you own the road',
    sub: 'Professional lessons for adult and advanced drivers — defensive skills, nervous-driver coaching, senior refreshers and highway confidence. Book with a real instructor and see live times in about a minute.',
    primary: { label: 'Book a lesson', href: '/book' },
    secondary: { label: 'See lessons', href: '/book' },
    surface: 'primary',
  }),
  featureRow({
    items: [
      {
        title: 'Instructors who coach adults',
        body: 'Calm, experienced professionals who teach grown-ups — no teen-driver-ed vibe, just clear feedback and steady progress.',
      },
      {
        title: 'Defensive & advanced skills',
        body: 'Beyond passing a test: hazard awareness, space management and highway judgement that keep you safe for good.',
      },
      {
        title: 'Anxious-driver friendly',
        body: 'Put it off for years? Lost your nerve? We start exactly where you’re comfortable and never rush you.',
      },
      {
        title: 'Book on your schedule',
        body: 'Live availability across our instructors and dual-control cars — pick a time that fits your week, not ours.',
      },
    ],
  }),
  serviceMenu({
    heading: 'Lessons & assessments',
    intro: 'Start with a free assessment or jump straight into the lesson you need. Full prices and live availability are on the booking page.',
    surface: 'muted',
    columns: 2,
    items: [
      {
        name: 'Driving assessment & plan',
        priceCents: 0,
        durationMin: 45,
        desc: 'A short drive so we can map exactly what you need. Free.',
      },
      {
        name: 'Adult driving lesson',
        priceCents: 8500,
        durationMin: 60,
        desc: 'A focused hour building real road confidence.',
      },
      {
        name: 'Defensive driving session',
        priceCents: 13500,
        durationMin: 90,
        desc: 'Hazard awareness and crash-avoidance technique.',
      },
      {
        name: 'Nervous-driver coaching',
        priceCents: 9500,
        durationMin: 60,
        desc: 'Patient, judgement-free, at your own pace.',
      },
      {
        name: 'Advanced & highway lesson',
        priceCents: 16500,
        durationMin: 120,
        desc: 'Merging, lane discipline and freeway confidence.',
      },
      {
        name: 'License-transfer lesson',
        priceCents: 12500,
        durationMin: 90,
        desc: 'Local road rules so you pass the transfer first time.',
      },
    ],
    cta: { label: 'See everything & book', href: '/book' },
  }),
  splitFeature({
    image: url(IMG.method),
    alt: 'An instructor coaching an adult learner from the passenger seat on a city street',
    heading: 'Confidence is a skill — we teach it on purpose',
    body: [
      'Most people don’t lack ability. They lack a calm plan and the reps to trust it. So every lesson starts with a clear goal, breaks the drive into moves you can actually feel yourself nailing, and ends knowing exactly what’s next.',
      'Dual-control cars, unflappable instructors and honest feedback — that’s how a first-timer, a returning driver and a nervous one all leave steadier than they arrived.',
    ],
    cta: { label: 'Start with an assessment', href: '/book' },
  }),
  teamRow({
    heading: 'Your instructors',
    intro: 'Book by name — you’ll work with someone who teaches your kind of driving.',
    members: [
      {
        name: 'Ricardo Vega',
        role: 'Lead & defensive instructor',
        image: url(IMG.ricardo),
        alt: 'Ricardo Vega, lead defensive-driving instructor',
        bio: 'Twenty years on the road and a defensive-driving specialist. Ricardo runs the academy and its safety curriculum.',
      },
      {
        name: 'Dana Whitfield',
        role: 'Nervous-driver coach',
        image: url(IMG.dana),
        alt: 'Dana Whitfield, anxious-driver coach',
        bio: 'The person you want if driving makes you anxious. Endlessly patient, zero judgement, small wins that add up fast.',
      },
      {
        name: 'Theo Marsh',
        role: 'Advanced & highway instructor',
        image: url(IMG.theo),
        alt: 'Theo Marsh, advanced & highway instructor',
        bio: 'Freeways, interchanges and long-haul confidence. Theo takes good drivers and makes them genuinely sharp.',
      },
    ],
  }),
  testimonial({
    quote:
      'I avoided the freeway for eleven years. Three lessons with Dana and I drove myself two hours to see my sister — first time ever. I still can’t quite believe it.',
    attribution: 'Marisol T., nervous-driver program',
  }),
  bookingCta({
    title: 'Book your first lesson',
    sub: 'Pick a lesson, choose your instructor and see live times. Start with a free assessment if you’re not sure where you stand.',
    cta: { label: 'Book a lesson', href: '/book' },
  }),
];

const BOOK_INTRO = [
  typeHero({
    title: 'Book a lesson',
    sub: 'Choose a lesson or a free assessment to see live availability, then pick your instructor and time.',
    primary: { label: 'See lessons below', href: '/book' },
    surface: 'base',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.about),
    alt: 'A dual-control training car on a quiet residential road at golden hour',
    heading: 'About Apex Driving Academy',
    body: [
      'We built Apex for the drivers other schools overlook — adults starting late, people getting their nerve back, newcomers transferring a license, and good drivers who want to be great. Not a teen driver-ed mill.',
      'Every instructor here is a professional who coaches grown-ups: clear, respectful, and genuinely invested in you leaving the car safer and more confident than you got in.',
    ],
    cta: { label: 'Book a lesson', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'How we work',
    items: [
      {
        title: 'Assessment first',
        body: 'A free, no-obligation drive tells us where you are so we never sell you lessons you don’t need.',
      },
      {
        title: 'A real plan',
        body: 'You get a clear path — the specific skills to build and the order to build them in, not an open-ended meter running.',
      },
      {
        title: 'Skills that last',
        body: 'We teach defensive habits and judgement, so your confidence holds up long after the last lesson.',
      },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Find the academy',
    address: ['Apex Driving Academy', '4400 Corbett Avenue', 'Suite B · Denver, CO 80211'],
    mapLocation: '4400 Corbett Avenue, Denver, CO 80211',
    hours: [
      { day: 'Monday – Friday', time: '8:00 – 7:00' },
      { day: 'Saturday', time: '9:00 – 6:00' },
      { day: 'Sunday', time: '10:00 – 4:00' },
    ],
  }),
  bookingCta({
    title: 'Rather book than call?',
    sub: 'See live availability across our instructors and cars, and lock in your time online — no phone tag.',
    surface: 'muted',
    cta: { label: 'Book a lesson', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-driving-pro',
  name: 'Driving Academy (Pro)',
  summary:
    'A sharp, confident driving-academy site — a deep-navy primary, an electric-amber accent and a crisp near-white ground with modern-sans display. Installs online booking for lessons and assessments: adult, defensive, nervous-driver, senior-refresher, advanced/highway and license-transfer lessons, with three instructors booked by name and two dual-control training cars as bookable resources. Ships as "Apex Driving Academy" for adult and advanced drivers.',
  tagline: 'A confident, modern template for adult & advanced driving schools — book online from day one.',
  industry: 'Driving school',
  sortWeight: 21,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'Apex Driving Academy', tagline: 'Drive like you own the road.' },
  theme: apexdrive,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Apex Driving Academy — adult & advanced driving lessons',
      description:
        'Apex Driving Academy teaches adult and advanced drivers — defensive driving, nervous-driver coaching, senior refreshers, highway skills and license transfers. Book online.',
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
