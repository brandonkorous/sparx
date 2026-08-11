// sparx-dogtraining-behavior — "K9 Method", a results-driven PRIVATE dog-training
// & behavior specialist.
//
// The confident, professional opposite of the friendly group-class sibling (playful,
// teal, drop-in classes): a deep charcoal-navy ground, a confident AMBER accent and a
// sturdy condensed display over a clean sans. Bold in BOTH modes-worth of palette (a
// light near-white scheme and a dark scheme), tight radii, transformation-first. It
// sells a real behavior practice — private lessons, board-and-train, reactivity and
// aggression rehab, and service-dog foundations, all booked around a paid-or-free
// ASSESSMENT. Same booking spine as the salon template, a radically different business:
// book an assessment, get a plan, change the behavior.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-dogtraining-behavior.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-dogtraining-behavior/**" \
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
  hero: 'dogtraining-behavior-hero',
  method: 'dogtraining-behavior-method',
  dana: 'dogtraining-behavior-dana',
  marcus: 'dogtraining-behavior-marcus',
  priya: 'dogtraining-behavior-priya',
} as const;

// EMPTY on purpose — no curated hot-links yet, so every asset falls through to a stable
// picsum seed (prefixed `k9method-`). Drop real URLs in here keyed by seed to upgrade a
// single image without touching anything else.
const PHOTO: Record<string, string> = {
  "k9method-hero": "https://images.unsplash.com/photo-1620289052446-202137ffa876?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29ya2luZyUyMGRvZyUyMHRyYWluaW5nJTIwZm9jdXN8ZW58MHwwfHx8MTc4NjM5MTUxMnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "k9method-method": "https://images.unsplash.com/photo-1620289052446-202137ffa876?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZG9nJTIwdHJhaW5lciUyMHdvcmtpbmclMjBkb2d8ZW58MHwwfHx8MTc4NjM5MTUxNXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "k9method-dana": "https://images.unsplash.com/photo-1551779891-b83901e1f8b3?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjBkb2clMjB0cmFpbmVyJTIwcG9ydHJhaXR8ZW58MHwwfHx8MTc4NjM5MTUxOHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "k9method-marcus": "https://images.unsplash.com/photo-1535812859-6bfd2f132e78?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZG9nJTIwdHJhaW5lciUyMHBvcnRyYWl0JTIwbWFufGVufDB8MHx8fDE3ODYzOTE0OTh8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "k9method-priya": "https://images.unsplash.com/photo-1660849636221-9a1fc064d57a?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZG9nJTIwaGFuZGxlciUyMHBvcnRyYWl0fGVufDB8MHx8fDE3ODYzOTE1MjF8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
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
    url: src('k9method-hero'),
    alt: 'A focused working dog holding a steady sit, eyes locked on its handler',
  },
  {
    id: IMG.method,
    url: src('k9method-method'),
    alt: 'A trainer coaching a dog and owner through a calm leash exercise at home',
  },
  {
    id: IMG.dana,
    url: src('k9method-dana'),
    alt: 'Dana Cole, lead behavior specialist',
  },
  {
    id: IMG.marcus,
    url: src('k9method-marcus'),
    alt: 'Marcus Reyes, reactivity & aggression specialist',
  },
  {
    id: IMG.priya,
    url: src('k9method-priya'),
    alt: 'Priya Shah, obedience & board-and-train specialist',
  },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-dogtraining-behavior: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "k9method": crisp near-white ground, deep charcoal-navy primary, confident ─
//    amber accent, a DARK readable secondary ink, sturdy condensed display over a clean
//    sans. BOTH schemes authored (a light default + a full dark scheme whose secondary is
//    a readable LIGHT tone). Tight radii — a bold, professional brand, not a soft one.
const k9method = defineTheme({
  name: 'k9method',
  type: { body: face('Inter', 'sans-serif'), head: face('Oswald', 'sans-serif') },
  shape: { selector: '0.125rem', field: '0.125rem', box: '0.25rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(98% 0.004 255)', // crisp near-white ground
      'oklch(95% 0.006 255)', // raised panel
      'oklch(89% 0.009 255)', // hairline / border
      'oklch(22% 0.02 262)', // deep charcoal-navy ink
    ],
    roles: {
      primary: 'oklch(28% 0.03 262)', // deep charcoal navy
      secondary: 'oklch(34% 0.022 262)', // dark charcoal — readable text-secondary
      accent: 'oklch(72% 0.16 66)', // confident amber
      neutral: 'oklch(26% 0.02 262)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(20% 0.02 262)', // deep charcoal-navy ground
      'oklch(24% 0.022 262)', // raised panel
      'oklch(30% 0.024 262)', // hairline / border
      'oklch(96% 0.006 255)', // bright ink
    ],
    roles: {
      primary: 'oklch(93% 0.01 255)', // near-white chip on the dark ground
      secondary: 'oklch(80% 0.02 262)', // readable LIGHT secondary
      accent: 'oklch(77% 0.17 66)', // brighter amber
      neutral: 'oklch(30% 0.02 262)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the booking spine (policies, specialist trainers + hours, the menu) ────
const hours = (days: number[], startMinute: number, endMinute: number) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

const SCHEDULING = {
  policies: [
    {
      handle: 'dogtraining-standard',
      name: 'Standard booking',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [1440, 120],
      policyText:
        'Please give us at least 24 hours’ notice to change or cancel a session. We send a reminder the day before and two hours ahead so it never sneaks up on you.',
    },
    {
      handle: 'program-deposit',
      name: 'Board-and-train deposit',
      depositType: 'deposit',
      depositAmountCents: 20000,
      cancellationWindowHours: 48,
      reminderOffsetsMin: [2880, 1440, 120],
      policyText:
        'Board-and-train places are limited, so a $200 deposit reserves your dog’s spot and comes off the program tuition. Reschedule with 48 hours’ notice and it carries over.',
    },
  ],
  // Largely in-home / private work — a session books with a TRAINER and nothing else
  // (single-requirement). Skill tags route each service to a trainer who actually does it:
  // every trainer carries 'private', the reactivity/aggression tags live only where the
  // specialist expertise does.
  resources: [
    {
      handle: 'dana',
      name: 'Dana Cole',
      kind: 'staff',
      skillTags: ['behavior', 'private', 'board-train'],
      windows: hours([1, 2, 3, 4, 5], 540, 1080), // Mon–Fri 9–6
    },
    {
      handle: 'marcus',
      name: 'Marcus Reyes',
      kind: 'staff',
      skillTags: ['reactivity', 'aggression', 'private'],
      windows: [...hours([2, 3, 4, 5], 600, 1140), ...hours([6], 540, 900)], // Tue–Fri 10–7, Sat 9–3
    },
    {
      handle: 'priya',
      name: 'Priya Shah',
      kind: 'staff',
      skillTags: ['obedience', 'private', 'board-train'],
      windows: [...hours([1, 3, 4, 5], 540, 1020), ...hours([6], 540, 900)], // Mon/Wed–Fri 9–5, Sat 9–3
    },
  ],
  services: [
    {
      handle: 'behavior-assessment',
      name: 'Behavior assessment',
      description:
        'Where every dog starts. A specialist meets you and your dog, watches the behavior first-hand, and leaves you with a written plan and a clear next step. No obligation to book anything more.',
      durationMinutes: 60,
      priceCents: 0,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'trainer', kind: 'staff', skillTags: ['private'], count: 1 }],
      policyHandle: 'dogtraining-standard',
    },
    {
      handle: 'private-session',
      name: 'Private session',
      description:
        'One-on-one coaching for you and your dog, built on the plan from your assessment. We train the behavior AND the handler, so the results hold long after we leave.',
      durationMinutes: 60,
      priceCents: 12000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'trainer', kind: 'staff', skillTags: ['private'], count: 1 }],
      policyHandle: 'dogtraining-standard',
    },
    {
      handle: 'puppy-foundations-consult',
      name: 'Puppy foundations consult',
      description:
        'Start right and skip the hard re-training later. We set up confident socialization, house habits, name recognition and impulse control before problems have a chance to form.',
      durationMinutes: 45,
      priceCents: 9000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'trainer', kind: 'staff', skillTags: ['private'], count: 1 }],
      policyHandle: 'dogtraining-standard',
    },
    {
      handle: 'reactivity-consult',
      name: 'Reactivity consult',
      description:
        'For the dog who lunges, barks or spirals on leash. A reactivity specialist reads the triggers and thresholds, then builds a step-by-step plan to bring the intensity down and the calm up.',
      durationMinutes: 75,
      priceCents: 14000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'trainer', kind: 'staff', skillTags: ['reactivity'], count: 1 },
      ],
      policyHandle: 'dogtraining-standard',
    },
    {
      handle: 'board-and-train-consult',
      name: 'Board-and-train consult',
      description:
        'Immersive training where your dog lives and learns with a specialist, then comes home with the skills transferred to you. This consult scopes the program and reserves the place; the deposit applies to tuition.',
      durationMinutes: 45,
      priceCents: 20000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'trainer', kind: 'staff', skillTags: ['board-train'], count: 1 },
      ],
      policyHandle: 'program-deposit',
    },
    {
      handle: 'aggression-consult',
      name: 'Aggression consult',
      description:
        'Serious behavior handled seriously. An aggression specialist assesses the history and the risk in person, then lays out a realistic, humane plan to keep everyone safe while the behavior changes.',
      durationMinutes: 90,
      priceCents: 18000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'trainer', kind: 'staff', skillTags: ['aggression'], count: 1 },
      ],
      policyHandle: 'dogtraining-standard',
    },
    {
      handle: 'follow-up-session',
      name: 'Follow-up session',
      description:
        'A shorter check-in between programs to sharpen what’s working, troubleshoot what isn’t, and keep the progress moving. Best once you’ve completed an assessment or program with us.',
      durationMinutes: 30,
      priceCents: 7000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'trainer', kind: 'staff', skillTags: ['private'], count: 1 }],
      policyHandle: 'dogtraining-standard',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  photoHero({
    image: url(IMG.hero),
    alt: 'A focused working dog holding a steady sit, eyes locked on its handler',
    title: 'Real behavior change, led by specialists',
    sub: 'Private training and board-and-train for the dogs other programs give up on — reactivity, aggression, puppy foundations and service-dog work. It starts with an assessment.',
    primary: { label: 'Book an assessment', href: '/book' },
    secondary: { label: 'See services', href: '/book' },
    overlay: 'darker',
  }),
  featureRow({
    items: [
      {
        title: 'Behavior specialists, not generalists',
        body: 'Every trainer here works cases full-time — reactivity, aggression, anxiety and obedience. You get the specialist your dog’s behavior actually calls for.',
      },
      {
        title: 'A proven method, not guesswork',
        body: 'We assess first, then follow a clear, repeatable plan built on how dogs actually learn. You’ll know the why behind every step and how to measure progress.',
      },
      {
        title: 'In-home & board-and-train',
        body: 'Train where the behavior happens — in your home and your routine — or send your dog for immersive board-and-train and get the skills handed back to you.',
      },
      {
        title: 'Lifetime support',
        body: 'The relationship doesn’t end at the last session. Graduates keep access to follow-ups and guidance, so the results stick for the life of the dog.',
      },
    ],
  }),
  serviceMenu({
    heading: 'What we work on',
    intro: 'Every path starts with an assessment. Full pricing, session lengths and live availability are on the booking page.',
    surface: 'muted',
    columns: 3,
    items: [
      { name: 'Behavior assessment', priceCents: 0, durationMin: 60, desc: 'Meet, evaluate, and leave with a written plan.' },
      { name: 'Private session', priceCents: 12000, durationMin: 60, desc: 'One-on-one coaching for dog and handler.' },
      { name: 'Puppy foundations consult', priceCents: 9000, durationMin: 45, desc: 'Start right and skip the hard re-training.' },
      { name: 'Reactivity consult', priceCents: 14000, durationMin: 75, desc: 'Bring the leash intensity down for good.' },
      { name: 'Aggression consult', priceCents: 18000, durationMin: 90, desc: 'Serious behavior, assessed and handled safely.' },
      { name: 'Board-and-train consult', priceCents: 20000, durationMin: 45, desc: 'Immersive training, skills transferred to you.' },
    ],
    cta: { label: 'See everything & book', href: '/book' },
  }),
  splitFeature({
    image: url(IMG.method),
    alt: 'A trainer coaching a dog and owner through a calm leash exercise at home',
    heading: 'The K9 Method: assess, plan, transform',
    body: [
      'Most training fails because it treats symptoms and skips the cause. We do the opposite — a real assessment to understand why your dog does what it does, then a step-by-step plan that changes the behavior at its root.',
      'And we train you as much as the dog. When you understand the method and can run it yourself, the calm, confident dog you met in session is the one you keep at home.',
    ],
    cta: { label: 'Book an assessment', href: '/book' },
  }),
  teamRow({
    heading: 'Your specialists',
    intro: 'Book by name — you’ll work with the specialist whose expertise fits your dog.',
    members: [
      {
        name: 'Dana Cole',
        role: 'Lead behavior specialist',
        image: url(IMG.dana),
        alt: 'Dana Cole, lead behavior specialist',
        bio: 'Fifteen years on complex behavior cases and service-dog foundations. Dana builds the plan the whole team trains to.',
      },
      {
        name: 'Marcus Reyes',
        role: 'Reactivity & aggression specialist',
        image: url(IMG.marcus),
        alt: 'Marcus Reyes, reactivity & aggression specialist',
        bio: 'Calm under pressure with the toughest cases — leash reactivity, resource guarding and bite histories handled safely and humanely.',
      },
      {
        name: 'Priya Shah',
        role: 'Obedience & board-and-train specialist',
        image: url(IMG.priya),
        alt: 'Priya Shah, obedience & board-and-train specialist',
        bio: 'Runs the board-and-train program and rock-solid obedience work, then transfers every skill back to the owner.',
      },
    ],
  }),
  testimonial({
    quote: 'We were ready to rehome our dog after two bad bites. Six weeks with K9 Method and he greets guests calmly at the door. They didn’t just fix the dog — they taught us how to keep him that way.',
    attribution: 'The Alvarez family, K9 Method graduates',
    surface: 'primary',
  }),
  bookingCta({
    title: 'It starts with an assessment',
    sub: 'Tell us about your dog, meet a specialist, and walk away with a plan. Booking online takes about a minute.',
    cta: { label: 'Book an assessment', href: '/book' },
  }),
];

const BOOK_INTRO = [
  photoHero({
    image: url(IMG.method),
    alt: 'A trainer coaching a dog and owner through a calm leash exercise at home',
    title: 'Book your assessment',
    sub: 'Choose a service to see prices and live availability, then pick your specialist and time. Every path begins with an assessment.',
    primary: { label: 'See services below', href: '/book' },
    overlay: 'darker',
    align: 'start',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.hero),
    alt: 'A focused working dog holding a steady sit, eyes locked on its handler',
    heading: 'About K9 Method',
    body: [
      'K9 Method exists for the dogs that group classes and quick fixes couldn’t reach — the reactive, the anxious, the ones with a bite history and an owner running out of options. We take those cases seriously, and we get results.',
      'Our promise is simple: an honest assessment, a plan grounded in how dogs actually learn, and a specialist who treats your dog’s behavior — and your family’s safety — like it matters. Because it does.',
    ],
    cta: { label: 'Book an assessment', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'How we work',
    items: [
      {
        title: 'Assessment first',
        body: 'We never sell a program before we understand the dog. Every relationship starts with a real evaluation and a written plan you own.',
      },
      {
        title: 'Humane, modern methods',
        body: 'Clear, consistent, science-based training — no intimidation, no gimmicks. We change behavior by teaching, not by force.',
      },
      {
        title: 'Built to last',
        body: 'We coach the owner as hard as the dog and back it with lifetime follow-up support, so the transformation holds for good.',
      },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Visit the training center',
    address: ['K9 Method', '90 Ironwood Road', 'Suite 4 · Austin, TX 78745'],
    mapLocation: '90 Ironwood Road, Austin, TX 78745',
    hours: [
      { day: 'Monday – Friday', time: '9:00 – 7:00' },
      { day: 'Saturday', time: '9:00 – 3:00' },
      { day: 'Sunday', time: 'Closed' },
      { day: 'In-home sessions', time: 'By appointment' },
    ],
  }),
  bookingCta({
    title: 'Rather book than call?',
    sub: 'See live availability and reserve your assessment online — no phone tag, no waiting on a callback.',
    surface: 'muted',
    cta: { label: 'Book an assessment', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-dogtraining-behavior',
  name: 'sparx — Dog Training (Behavior)',
  summary:
    'A bold, professional dog-training & behavior site — a deep charcoal-navy palette, a confident amber accent and sturdy condensed type. Installs a working booking flow: online booking for assessments and private sessions, specialist trainers you choose by name with their own hours, and a program-deposit policy for board-and-train. Covers reactivity, aggression, puppy foundations and service-dog work. Ships as "K9 Method".',
  tagline: 'A bold, results-driven template for private dog trainers — book assessments from day one.',
  industry: 'Dog training',
  sortWeight: 51,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'K9 Method', tagline: 'Real behavior change, led by specialists.' },
  theme: k9method,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'K9 Method — private dog training & behavior',
      description:
        'K9 Method is a results-driven private dog-training and behavior practice: reactivity, aggression, puppy foundations, board-and-train and service-dog work. Book your assessment online.',
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
