// sparx-driving-teen — "RoadReady Driving School", a friendly TEEN driver's-ed studio.
//
// The warm, encouraging teen sibling of the driving-school lane: a cheerful blue primary,
// a sunny coral accent, a warm off-white ground and rounded, friendly type — safety-first
// without feeling clinical. Deliberately the OPPOSITE of the adult/advanced/defensive
// driving academy template (that one leans serious and performance-minded): this is the
// patient, confidence-building school for teens and brand-new drivers — same booking spine,
// a different business. Its booking core routes BOTH an instructor AND a dual-brake
// training car for behind-the-wheel lessons (a multi-requirement booking), while the
// classroom driver's-ed session needs the instructor only.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-driving-teen.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-driving-teen/**" \
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
  hero: 'driving-teen-hero',
  lesson: 'driving-teen-lesson',
  maria: 'driving-teen-maria',
  james: 'driving-teen-james',
  tanya: 'driving-teen-tanya',
} as const;

// No hosted photography yet — every seed falls back to a stable picsum placeholder, so the
// bundle previews and ships with real, sized images out of the box. Swap a URL in here to
// pin a specific photo without touching any call site.
const PHOTO: Record<string, string> = {
  "roadready-hero": "https://images.unsplash.com/photo-1516862523118-a3724eb136d7?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dGVlbiUyMGRyaXZpbmclMjBjYXIlMjBsZXNzb258ZW58MHwwfHx8MTc4NjM5NDIzNnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "roadready-lesson": "https://images.unsplash.com/photo-1516862523118-a3724eb136d7?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZHJpdmluZyUyMGluc3RydWN0b3IlMjBjYXJ8ZW58MHwwfHx8MTc4NjM5NDIzOXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "roadready-maria": "https://images.unsplash.com/photo-1506863530036-1efeddceb993?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjBpbnN0cnVjdG9yJTIwcG9ydHJhaXR8ZW58MHwwfHx8MTc4NjM5NDI0Mnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "roadready-james": "https://images.unsplash.com/photo-1593035013811-2db9b3c36980?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZHJpdmluZyUyMGluc3RydWN0b3IlMjBwb3J0cmFpdCUyMG1hbnxlbnwwfDB8fHwxNzg2Mzk0MjQ1fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "roadready-tanya": "https://images.unsplash.com/photo-1590650213165-c1fef80648c4?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjB0ZWFjaGVyJTIwcG9ydHJhaXR8ZW58MHwwfHx8MTc4NjM5NDI0OHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
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
    url: src('roadready-hero'),
    alt: 'A happy new teen driver at the wheel with a calm instructor beside them',
  },
  {
    id: IMG.lesson,
    url: src('roadready-lesson'),
    alt: 'An instructor coaching a learner through a turn in a dual-brake training car',
  },
  {
    id: IMG.maria,
    url: src('roadready-maria'),
    alt: 'Maria Alvarez, behind-the-wheel instructor',
  },
  {
    id: IMG.james,
    url: src('roadready-james'),
    alt: 'James Park, driver’s-ed instructor',
  },
  {
    id: IMG.tanya,
    url: src('roadready-tanya'),
    alt: 'Tanya Brooks, road-test prep instructor',
  },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-driving-teen: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "roadready": warm off-white ground, friendly blue primary, sunny coral accent ─
const roadready = defineTheme({
  name: 'roadready',
  type: { body: face('Inter', 'sans-serif'), head: face('Nunito', 'sans-serif') },
  shape: { selector: '0.75rem', field: '0.625rem', box: '1rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(98% 0.006 95)', // warm off-white
      'oklch(95% 0.009 95)', // soft cream
      'oklch(90% 0.012 240)', // cool hairline
      'oklch(26% 0.03 250)', // deep blue-charcoal ink
    ],
    roles: {
      primary: 'oklch(58% 0.14 240)', // friendly blue
      secondary: 'oklch(34% 0.03 250)', // dark slate — readable micro-labels on light
      accent: 'oklch(72% 0.15 45)', // sunny coral
      neutral: 'oklch(30% 0.02 250)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(22% 0.02 250)',
      'oklch(18% 0.016 250)',
      'oklch(14% 0.012 250)',
      'oklch(96% 0.006 95)',
    ],
    roles: {
      primary: 'oklch(72% 0.13 240)',
      secondary: 'oklch(80% 0.02 250)',
      accent: 'oklch(77% 0.14 45)',
      neutral: 'oklch(82% 0.02 250)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the booking spine (policies, instructors + cars, the lesson menu) ─────
// Behind-the-wheel lessons need TWO resources at once: an instructor (staff) AND a
// dual-brake training car (asset). The classroom driver's-ed + permit-prep sessions need
// the instructor only. Skill tags: every requirement tag below exists on a matching
// resource, and ALL requirement tags must match for a resource to be eligible.
const hours = (days: number[], startMinute: number, endMinute: number) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

// After-school (weekday afternoons/evenings) + weekend daytime — when teens can actually
// come in. Cars are available across the same operating window.
const AFTER_SCHOOL = [...hours([1, 2, 3, 4, 5], 900, 1200), ...hours([6, 0], 540, 1020)];

const SCHEDULING = {
  policies: [
    {
      handle: 'roadready-standard',
      name: 'Standard booking',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [1440, 120],
      policyText:
        'Life happens — just give us 24 hours’ notice to change or cancel and there’s no charge. We’ll text a reminder the day before and two hours ahead so nobody forgets.',
    },
    {
      handle: 'roadready-noshow',
      name: 'No-show policy',
      depositType: 'deposit',
      depositAmountCents: 2000,
      cancellationWindowHours: 24,
      reminderOffsetsMin: [2880, 1440, 120],
      policyText:
        'Behind-the-wheel time is one-on-one, so these lessons hold a $20 deposit that comes off your total. Cancel or reschedule with 24 hours’ notice and it carries over; a no-show forfeits the hold.',
    },
  ],
  resources: [
    {
      handle: 'maria',
      name: 'Maria Alvarez',
      kind: 'staff',
      skillTags: ['behind-wheel', 'teen', 'general'],
      windows: AFTER_SCHOOL,
    },
    {
      handle: 'james',
      name: 'James Park',
      kind: 'staff',
      skillTags: ['drivers-ed', 'teen', 'general'],
      windows: [...hours([1, 2, 3, 4], 930, 1170), ...hours([6], 540, 960)], // Mon–Thu after school + Sat
    },
    {
      handle: 'tanya',
      name: 'Tanya Brooks',
      kind: 'staff',
      skillTags: ['road-test', 'behind-wheel', 'general'],
      windows: [...hours([2, 3, 4, 5], 900, 1200), ...hours([6, 0], 540, 1020)], // Tue–Fri after school + weekends
    },
    {
      handle: 'training-car-1',
      name: 'Training Car 1 (dual-brake sedan)',
      kind: 'asset',
      skillTags: ['training-car'],
      windows: AFTER_SCHOOL,
    },
    {
      handle: 'training-car-2',
      name: 'Training Car 2 (dual-brake sedan)',
      kind: 'asset',
      skillTags: ['training-car'],
      windows: AFTER_SCHOOL,
    },
  ],
  services: [
    {
      handle: 'free-consultation',
      name: 'Free consultation',
      description:
        'A no-pressure chat to map out a plan — where you are, what you need for your license, and the schedule that fits. Great for nervous first-timers and their parents.',
      durationMinutes: 45,
      priceCents: 0,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'instructor', kind: 'staff', skillTags: ['general'], count: 1 },
      ],
      policyHandle: 'roadready-standard',
    },
    {
      handle: 'intro-lesson',
      name: 'Intro drive',
      description:
        'A gentle first time behind the wheel in an empty lot and quiet streets — seat, mirrors, brakes and your very first turns, all at your pace.',
      durationMinutes: 45,
      priceCents: 4500,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'instructor', kind: 'staff', skillTags: ['behind-wheel'], count: 1 },
        { role: 'car', kind: 'asset', skillTags: ['training-car'], count: 1 },
      ],
      policyHandle: 'roadready-noshow',
    },
    {
      handle: 'behind-the-wheel-lesson',
      name: 'Behind-the-wheel lesson',
      description:
        'A full one-on-one driving lesson in a dual-brake car — real roads, real traffic, building confidence turn by turn with a patient instructor beside you.',
      durationMinutes: 90,
      priceCents: 9000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'instructor', kind: 'staff', skillTags: ['behind-wheel'], count: 1 },
        { role: 'car', kind: 'asset', skillTags: ['training-car'], count: 1 },
      ],
      policyHandle: 'roadready-noshow',
    },
    {
      handle: 'drivers-ed-session',
      name: 'Driver’s-ed classroom session',
      description:
        'The classroom half of learning to drive — road signs, right-of-way, safe following distance and the rules of the road, taught in plain language for teens.',
      durationMinutes: 120,
      priceCents: 7500,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'instructor', kind: 'staff', skillTags: ['drivers-ed'], count: 1 },
      ],
      policyHandle: 'roadready-standard',
    },
    {
      handle: 'permit-prep-session',
      name: 'Permit prep',
      description:
        'Everything you need to walk into the DMV ready for the written permit test — practice questions, the tricky signs, and the stuff that trips people up.',
      durationMinutes: 60,
      priceCents: 5500,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'instructor', kind: 'staff', skillTags: ['drivers-ed'], count: 1 },
      ],
      policyHandle: 'roadready-standard',
    },
    {
      handle: 'road-test-prep',
      name: 'Road-test prep',
      description:
        'A dress-rehearsal for test day on the actual test route — parallel parking, three-point turns and the checklist examiners grade, so you show up calm and ready.',
      durationMinutes: 90,
      priceCents: 9500,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'instructor', kind: 'staff', skillTags: ['road-test'], count: 1 },
        { role: 'car', kind: 'asset', skillTags: ['training-car'], count: 1 },
      ],
      policyHandle: 'roadready-noshow',
    },
    {
      handle: 'refresher-lesson',
      name: 'Refresher lesson',
      description:
        'Back after a break, or just want to shake off the nerves? A focused hour to rebuild confidence on the skills that feel rusty — no judgment, just practice.',
      durationMinutes: 60,
      priceCents: 6000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'instructor', kind: 'staff', skillTags: ['behind-wheel'], count: 1 },
        { role: 'car', kind: 'asset', skillTags: ['training-car'], count: 1 },
      ],
      policyHandle: 'roadready-noshow',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  photoHero({
    image: url(IMG.hero),
    alt: 'A happy new teen driver at the wheel with a calm instructor beside them',
    title: 'Confident behind the wheel, one lesson at a time',
    sub: 'A friendly, safety-first driving school for teens and brand-new drivers. Patient instructors, dual-brake cars, and a plan that goes at your pace — not the other way around.',
    primary: { label: 'Book a lesson', href: '/book' },
    secondary: { label: 'See lessons', href: '/book' },
    overlay: 'dark',
  }),
  featureRow({
    items: [
      {
        title: 'Patient, certified instructors',
        body: 'Every instructor is state-certified, background-checked, and genuinely kind about it. Nervous drivers are our specialty — we never rush and never yell.',
      },
      {
        title: 'Dual-brake safety cars',
        body: 'You learn in a car with a second brake on the instructor’s side, so there’s always a backup. It’s the reason first lessons feel a lot less scary.',
      },
      {
        title: 'After-school & weekend times',
        body: 'Book around class, practice and family life. Live availability shows exactly when your instructor and a car are both free.',
      },
      {
        title: 'A high road-test pass rate',
        body: 'Most of our students pass the DMV road test on the first try — because we practice on the real routes until it feels routine.',
      },
    ],
  }),
  serviceMenu({
    heading: 'Lessons & packages',
    intro: 'Start wherever you are — a first drive, the classroom hours, or a final tune-up before the test. Full prices and live availability are on the booking page.',
    surface: 'muted',
    columns: 2,
    items: [
      { name: 'Intro drive', priceCents: 4500, durationMin: 45, desc: 'A gentle first time behind the wheel, at your pace.' },
      { name: 'Behind-the-wheel lesson', priceCents: 9000, durationMin: 90, desc: 'A full one-on-one lesson on real roads.' },
      { name: 'Driver’s-ed classroom session', priceCents: 7500, durationMin: 120, desc: 'Signs, rules and safe habits, in plain language.' },
      { name: 'Road-test prep', priceCents: 9500, durationMin: 90, desc: 'A dress-rehearsal on the actual test route.' },
    ],
    cta: { label: 'See everything & book', href: '/book' },
  }),
  splitFeature({
    image: url(IMG.lesson),
    alt: 'An instructor coaching a learner through a turn in a dual-brake training car',
    heading: 'We teach confidence, not just parallel parking',
    body: [
      'Learning to drive is nerve-wracking — for teens and parents both. So we start slow, explain the why behind every rule, and celebrate the small wins until the big stuff feels easy.',
      'By the time you take your test, driving isn’t a thing you survive. It’s a thing you’re good at. That’s the whole goal: a driver who’s calm, safe and actually enjoys the road.',
    ],
    cta: { label: 'Book a lesson', href: '/book' },
  }),
  teamRow({
    heading: 'Meet your instructors',
    intro: 'Book by name — you’ll build a rhythm with the same person every lesson.',
    members: [
      { name: 'Maria Alvarez', role: 'Behind-the-wheel instructor', image: url(IMG.maria), alt: 'Maria Alvarez, behind-the-wheel instructor', bio: 'Ten years teaching first-time teen drivers. Endlessly patient with the nervous ones.' },
      { name: 'James Park', role: 'Driver’s-ed instructor', image: url(IMG.james), alt: 'James Park, driver’s-ed instructor', bio: 'Makes the classroom hours and permit rules genuinely make sense — no boring lectures.' },
      { name: 'Tanya Brooks', role: 'Road-test prep instructor', image: url(IMG.tanya), alt: 'Tanya Brooks, road-test prep instructor', bio: 'Knows every local test route by heart and gets students test-day ready and calm.' },
    ],
  }),
  testimonial({
    quote: 'My daughter was terrified to even sit in the driver’s seat. Six lessons later she passed her road test on the first try — and actually likes driving now. I can’t thank RoadReady enough.',
    attribution: 'Denise M., parent of a new driver',
    surface: 'muted',
  }),
  bookingCta({
    title: 'Ready to get started?',
    sub: 'Pick a lesson, choose your instructor and see live times. Not sure where to begin? The free consultation is a great first step.',
    cta: { label: 'Book a lesson', href: '/book' },
  }),
];

const BOOK_INTRO = [
  photoHero({
    image: url(IMG.lesson),
    alt: 'An instructor coaching a learner through a turn in a dual-brake training car',
    title: 'Book a lesson',
    sub: 'Choose a lesson to see the price and live availability, then pick your instructor and time. Behind-the-wheel lessons include a dual-brake training car.',
    primary: { label: 'See lessons below', href: '/book' },
    overlay: 'darker',
    align: 'start',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.hero),
    alt: 'A happy new teen driver at the wheel with a calm instructor beside them',
    heading: 'About RoadReady Driving School',
    body: [
      'We started RoadReady because learning to drive shouldn’t feel like a test you’re failing before it begins. New drivers deserve patience, a calm car, and someone in the passenger seat who’s genuinely on their side.',
      'So that’s what we built: certified instructors, dual-brake safety cars, and a plan that meets each teen exactly where they are — from a white-knuckle first drive to a confident, licensed driver.',
    ],
    cta: { label: 'Book a lesson', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'How we keep it safe and encouraging',
    items: [
      { title: 'Safety comes first, always', body: 'Dual-brake cars, quiet practice routes to start, and instructors trained to keep a lesson calm — because a relaxed driver is a safe driver.' },
      { title: 'A real plan, not random hours', body: 'Every student gets a path: what to practice, what comes next, and exactly what the DMV will ask on test day.' },
      { title: 'Parents in the loop', body: 'We’ll tell you honestly how it’s going and what to practice together between lessons — no surprises, no upselling.' },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Visit RoadReady',
    address: ['RoadReady Driving School', '412 Maple Avenue', 'Suite 5 · Springfield, IL 62704'],
    mapLocation: '412 Maple Avenue, Springfield, IL 62704',
    hours: [
      { day: 'Monday – Friday', time: '3:00 – 8:00' },
      { day: 'Saturday', time: '9:00 – 5:00' },
      { day: 'Sunday', time: '9:00 – 5:00' },
      { day: 'Holidays', time: 'Closed' },
    ],
  }),
  bookingCta({
    title: 'Rather book than call?',
    sub: 'See live availability for every instructor and car, and reserve your lesson online — no phone tag.',
    surface: 'muted',
    cta: { label: 'Book a lesson', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-driving-teen',
  name: 'Driving School (Teen)',
  summary:
    'A cheerful, safety-first template for a teen driving school — a warm off-white palette with a friendly blue and a sunny coral, rounded and encouraging. Installs a working booking flow: real lessons and packages (intro drive, behind-the-wheel, driver’s ed, permit and road-test prep), patient instructors you book by name, and dual-brake training cars booked alongside them for behind-the-wheel time. Ships as "RoadReady Driving School".',
  tagline: 'A friendly, encouraging template for teen driving schools — book lessons online from day one.',
  industry: 'Driving school',
  sortWeight: 22,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'RoadReady Driving School', tagline: 'Confident drivers start here.' },
  theme: roadready,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'RoadReady Driving School — patient teen driving lessons',
      description:
        'RoadReady is a friendly, safety-first driving school for teens and new drivers. Certified instructors, dual-brake cars, driver’s ed and road-test prep. Book a lesson online.',
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
