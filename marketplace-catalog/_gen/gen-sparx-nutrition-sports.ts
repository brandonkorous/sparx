// sparx-nutrition-sports — "Fuel Performance Nutrition", a SPORTS & PERFORMANCE
// nutrition practice.
//
// The bold, data-driven opposite of the warm whole-health wellness sibling: a crisp
// near-white ground, an ELECTRIC-BLUE primary and a lime accent, with a sturdy condensed
// display face over a clean sans. Athletic, sharp, performance-first. It sells a real
// practice — sports dietitians running fueling strategy, body-composition testing and
// sport-specific nutrition for endurance and strength athletes. Same booking spine as the
// salon template, a radically different business: the functional core is BOOK A CONSULT.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-nutrition-sports.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-nutrition-sports/**" \
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
  hero: 'nutrition-sports-hero',
  method: 'nutrition-sports-method',
  casey: 'nutrition-sports-casey',
  jordan: 'nutrition-sports-jordan',
  sam: 'nutrition-sports-sam',
} as const;

const PHOTO: Record<string, string> = {
  "fuel-hero": "https://images.unsplash.com/photo-1490645935967-10de6ba17061?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YXRobGV0ZSUyMGhlYWx0aHklMjBtZWFsfGVufDB8MHx8fDE3ODYzOTQyNzZ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "fuel-method": "https://images.unsplash.com/photo-1490645935967-10de6ba17061?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c3BvcnRzJTIwbnV0cml0aW9uJTIwZm9vZHxlbnwwfDB8fHwxNzg2Mzk0Mjc5fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "fuel-casey": "https://images.unsplash.com/photo-1526080652727-5b77f74eacd2?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c3BvcnRzJTIwZGlldGl0aWFuJTIwcG9ydHJhaXR8ZW58MHwwfHx8MTc4NjM5NDI4Mnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "fuel-jordan": "https://images.unsplash.com/photo-1578924608828-79a71150f711?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Zml0bmVzcyUyMHByb2Zlc3Npb25hbCUyMHBvcnRyYWl0JTIwbWFufGVufDB8MHx8fDE3ODYzOTQyODV8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "fuel-sam": "https://images.unsplash.com/photo-1607286908165-b8b6a2874fc4?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjBhdGhsZXRlJTIwcG9ydHJhaXR8ZW58MHwwfHx8MTc4NjM5NDI4N3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (seed: string): string =>
  PHOTO[seed] ?? `https://picsum.photos/seed/${seed}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}
const ASSETS: Asset[] = [
  { id: IMG.hero, url: src('fuel-hero'), alt: 'An endurance athlete refueling mid-training under stadium light' },
  { id: IMG.method, url: src('fuel-method'), alt: 'A dietitian reviewing performance and fueling data on a tablet' },
  { id: IMG.casey, url: src('fuel-casey'), alt: 'Casey Nolan, endurance sports dietitian' },
  { id: IMG.jordan, url: src('fuel-jordan'), alt: 'Jordan Reyes, strength & body-composition dietitian' },
  { id: IMG.sam, url: src('fuel-sam'), alt: 'Sam Whitfield, team & general sports dietitian' },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-nutrition-sports: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "fuel": crisp near-white ground, electric-blue primary, lime accent, a sturdy ─
//    condensed display over a clean sans. Tight radii, athletic and data-driven. Light in
//    the day, a deep athletic navy at night — both modes keep a READABLE secondary ink.
const fuel = defineTheme({
  name: 'fuel',
  type: { body: face('Inter', 'sans-serif'), head: face('Oswald', 'sans-serif') },
  shape: { selector: '0.25rem', field: '0.25rem', box: '0.375rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(98% 0.005 250)', // crisp near-white, faint cool cast
      'oklch(95% 0.008 250)', // raised panel
      'oklch(90% 0.012 250)', // hairline / border
      'oklch(24% 0.03 255)', // deep athletic ink
    ],
    roles: {
      primary: 'oklch(58% 0.19 250)', // electric blue
      secondary: 'oklch(34% 0.03 255)', // deep readable charcoal-navy
      accent: 'oklch(80% 0.2 128)', // energetic lime
      neutral: 'oklch(28% 0.02 255)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(20% 0.03 255)', // deep athletic navy
      'oklch(24% 0.032 255)',
      'oklch(30% 0.034 255)',
      'oklch(96% 0.01 250)',
    ],
    roles: {
      primary: 'oklch(70% 0.18 250)',
      secondary: 'oklch(82% 0.02 250)', // light, readable on navy
      accent: 'oklch(83% 0.2 128)',
      neutral: 'oklch(80% 0.02 250)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the booking spine (policies, dietitians + hours, the consult menu) ────
const hours = (days: number[], startMinute: number, endMinute: number) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

const SCHEDULING = {
  policies: [
    {
      handle: 'consult-standard',
      name: 'Standard consultation',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [1440, 120],
      policyText:
        'Reschedule or cancel with at least 24 hours’ notice — plans move, and we get it. We send a reminder the day before and two hours ahead so nothing slips.',
    },
    {
      handle: 'no-show',
      name: 'Late-cancel & no-show',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [2880, 1440, 120],
      policyText:
        'Your dietitian blocks the full session for you. Cancel inside 24 hours or miss it without notice and a no-show fee applies — one heads-up, then it’s the policy for everyone’s time.',
    },
  ],
  resources: [
    {
      handle: 'casey',
      name: 'Casey Nolan',
      kind: 'staff',
      skillTags: ['endurance', 'fueling', 'general'],
      windows: [...hours([1, 3, 5], 360, 660), ...hours([1, 3], 960, 1200)], // early AMs + Mon/Wed evenings
    },
    {
      handle: 'jordan',
      name: 'Jordan Reyes',
      kind: 'staff',
      skillTags: ['strength', 'bodycomp', 'general'],
      windows: [...hours([2, 4], 540, 1080), ...hours([6], 540, 780)], // Tue/Thu 9–6, Sat AM
    },
    {
      handle: 'sam',
      name: 'Sam Whitfield',
      kind: 'staff',
      skillTags: ['team', 'fueling', 'general'],
      windows: [...hours([1, 2, 3, 4, 5], 600, 900), ...hours([4], 960, 1200)], // weekday mid-day + Thu evening
    },
  ],
  services: [
    {
      handle: 'free-strategy-call',
      name: 'Free strategy call',
      description:
        'A no-cost 20-minute call to talk goals, your sport and where fueling is holding you back — and to map the right first step. Zero pressure, all direction.',
      durationMinutes: 20,
      priceCents: 0,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'dietitian', kind: 'staff', skillTags: ['general'], count: 1 }],
      policyHandle: 'consult-standard',
    },
    {
      handle: 'initial-assessment',
      name: 'Initial performance assessment',
      description:
        'The deep first session — training load, current intake, bloodwork if you have it, and your competitive calendar — built into a baseline and a clear plan of attack.',
      durationMinutes: 60,
      priceCents: 16500,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'dietitian', kind: 'staff', skillTags: ['general'], count: 1 }],
      policyHandle: 'no-show',
    },
    {
      handle: 'fueling-plan-consult',
      name: 'Fueling plan consult',
      description:
        'Build the day-to-day plan: what to eat around training, carbs by session type, hydration and race-day timing — the numbers dialed to your schedule, not a generic template.',
      durationMinutes: 45,
      priceCents: 12000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'dietitian', kind: 'staff', skillTags: ['general'], count: 1 }],
      policyHandle: 'no-show',
    },
    {
      handle: 'body-composition-consult',
      name: 'Body-composition consult',
      description:
        'Track lean mass and composition with real measurement, then set a fuelling target that changes the number on the scale for the right reasons — performance, not punishment.',
      durationMinutes: 45,
      priceCents: 12500,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'dietitian', kind: 'staff', skillTags: ['general'], count: 1 }],
      policyHandle: 'no-show',
    },
    {
      handle: 'endurance-nutrition-session',
      name: 'Endurance nutrition session',
      description:
        'For runners, cyclists and triathletes: carb loading, in-session fuelling rates, gut training and a race-week protocol you can rehearse before it counts.',
      durationMinutes: 60,
      priceCents: 14000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'dietitian', kind: 'staff', skillTags: ['endurance'], count: 1 }],
      policyHandle: 'no-show',
    },
    {
      handle: 'strength-nutrition-session',
      name: 'Strength nutrition session',
      description:
        'For lifters, field and court athletes: protein timing, a lean-gain or cut plan, and eating that supports heavy blocks instead of fighting them.',
      durationMinutes: 60,
      priceCents: 14000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'dietitian', kind: 'staff', skillTags: ['strength'], count: 1 }],
      policyHandle: 'no-show',
    },
    {
      handle: 'follow-up-session',
      name: 'Follow-up & check-in',
      description:
        'A 30-minute check-in to read the data, adjust the plan and keep momentum — the accountability that turns a good plan into a better season.',
      durationMinutes: 30,
      priceCents: 7500,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'dietitian', kind: 'staff', skillTags: ['general'], count: 1 }],
      policyHandle: 'consult-standard',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  photoHero({
    image: url(IMG.hero),
    alt: 'An endurance athlete refueling mid-training under stadium light',
    title: 'Fuel like your results depend on it',
    sub: 'Sports dietitians who turn how you eat into how you perform — data-driven fueling built around your sport, your training load and your next start line.',
    primary: { label: 'Book a consultation', href: '/book' },
    secondary: { label: 'See the consults', href: '/book' },
    overlay: 'darker',
    align: 'start',
  }),
  featureRow({
    items: [
      {
        title: 'Sports-certified dietitians',
        body: 'Board-certified specialists in sports nutrition — not influencers or apps. Real credentials, real practice, working with athletes at every level.',
      },
      {
        title: 'Data-driven fueling plans',
        body: 'We build off your numbers: training load, intake, body composition and race calendar. The plan is measured, not guessed, and it moves with your season.',
      },
      {
        title: 'Built for your sport',
        body: 'Endurance, strength or team — the fueling changes completely. You get a protocol for how you actually train and compete, not a one-size handout.',
      },
      {
        title: 'Accountability that sticks',
        body: 'Check-ins that read the data, adjust the plan and keep you on it. Progress you can see, not a plan that dies in week two.',
      },
    ],
  }),
  serviceMenu({
    heading: 'The consults',
    intro: 'Start with a free strategy call, or go straight to the session your goal calls for. Full pricing and live availability are on the booking page.',
    surface: 'muted',
    columns: 3,
    items: [
      { name: 'Free strategy call', priceCents: 0, durationMin: 20, desc: 'Twenty minutes to map your first move.' },
      { name: 'Initial performance assessment', priceCents: 16500, durationMin: 60, desc: 'Your full baseline and plan of attack.' },
      { name: 'Fueling plan consult', priceCents: 12000, durationMin: 45, desc: 'The day-to-day plan, dialed to your schedule.' },
      { name: 'Endurance nutrition session', priceCents: 14000, durationMin: 60, desc: 'Carb loading, in-session fuel, race-week protocol.' },
      { name: 'Strength nutrition session', priceCents: 14000, durationMin: 60, desc: 'Protein timing and eating that backs heavy blocks.' },
      { name: 'Body-composition consult', priceCents: 12500, durationMin: 45, desc: 'Real measurement, then a target that performs.' },
    ],
    cta: { label: 'See everything & book', href: '/book' },
  }),
  splitFeature({
    image: url(IMG.method),
    alt: 'A dietitian reviewing performance and fueling data on a tablet',
    heading: 'The performance-fueling method',
    body: [
      'We start with measurement — training load, current intake, body composition and your competition calendar — because a plan built on guesses fails at exactly the wrong moment.',
      'From there it’s a protocol you can execute: carbs matched to session type, protein and recovery timed to your blocks, hydration and race-day fueling rehearsed before it matters. Then we check the data and adjust — every season is an experiment we run with you.',
    ],
    cta: { label: 'Book a consultation', href: '/book' },
  }),
  teamRow({
    heading: 'Your dietitians',
    intro: 'Book by name — the specialist who fits your sport, one-to-one, every session.',
    members: [
      { name: 'Casey Nolan', role: 'Endurance dietitian', image: url(IMG.casey), alt: 'Casey Nolan, endurance sports dietitian', bio: 'Marathoners, cyclists and triathletes. Carb strategy, gut training and race-week protocols that hold up on the day.' },
      { name: 'Jordan Reyes', role: 'Strength & body-comp dietitian', image: url(IMG.jordan), alt: 'Jordan Reyes, strength & body-composition dietitian', bio: 'Lifters and field athletes. Lean-gain and cut plans, protein timing and body composition tracked with real data.' },
      { name: 'Sam Whitfield', role: 'Team & general dietitian', image: url(IMG.sam), alt: 'Sam Whitfield, team & general sports dietitian', bio: 'Team-sport athletes and everyday competitors. Practical fueling that fits training, travel and a real schedule.' },
    ],
  }),
  testimonial({
    quote: 'I bonked every long run and blamed my legs. Casey rebuilt my fueling around the actual numbers and I took nine minutes off my marathon PR — first time I ever finished strong. Turns out it was never my legs.',
    attribution: 'Priya M., marathoner',
    surface: 'primary',
  }),
  bookingCta({
    title: 'Your next PR starts with a plan',
    sub: 'Book the free strategy call, meet your dietitian and map the first move. It takes about a minute.',
    cta: { label: 'Book a consultation', href: '/book' },
  }),
];

const BOOK_INTRO = [
  photoHero({
    image: url(IMG.method),
    alt: 'A dietitian reviewing performance and fueling data on a tablet',
    title: 'Book your consultation',
    sub: 'Choose a consult to see pricing and live availability, then pick your dietitian and time. New here? Start with the free strategy call.',
    primary: { label: 'See the consults below', href: '/book' },
    overlay: 'darker',
    align: 'start',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.hero),
    alt: 'An endurance athlete refueling mid-training under stadium light',
    heading: 'About Fuel Performance Nutrition',
    body: [
      'We started Fuel because too many athletes train like professionals and eat like an afterthought — leaving real performance on the table for want of a plan built on evidence.',
      'So we do it the other way around: measure first, build a protocol you can execute, then track the data and adjust. No fad diets, no guilt, no generic handouts — just fueling engineered for how you actually train and compete.',
    ],
    cta: { label: 'Book a consultation', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'How we work',
    items: [
      { title: 'Measure, then plan', body: 'Every athlete starts with a real baseline — training load, intake, body composition and calendar. The plan comes from your numbers, not a template.' },
      { title: 'Evidence over trends', body: 'Board-certified sports dietitians working from the science, not the latest diet. If it doesn’t move your performance, it doesn’t make the plan.' },
      { title: 'Adjust every season', body: 'We read the data at each check-in and change what the results tell us to. Your fueling evolves as your training and goals do.' },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Visit the practice',
    address: ['Fuel Performance Nutrition', '220 Vanguard Way', 'Suite 5 · Austin, TX 78704'],
    mapLocation: '220 Vanguard Way, Austin, TX 78704',
    hours: [
      { day: 'Monday – Friday', time: '6:00 – 20:00' },
      { day: 'Saturday', time: '9:00 – 13:00' },
      { day: 'Sunday', time: 'Closed' },
      { day: 'Virtual sessions', time: 'Available nationwide' },
    ],
  }),
  bookingCta({
    title: 'Rather book than call?',
    sub: 'See live availability and reserve your consult online — in person in Austin or virtual anywhere. No phone tag.',
    surface: 'muted',
    cta: { label: 'Book a consultation', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-nutrition-sports',
  name: 'Nutrition (Sports & Performance)',
  summary:
    'A bold, athletic sports-nutrition site — a crisp near-white ground, an electric-blue primary and a lime accent with a sturdy condensed display. Installs a working booking flow: a real consult menu (free strategy call, performance assessment, fueling plans, endurance & strength sessions, body-composition testing, follow-ups), three sports dietitians booked by name with their own hours, and a no-show policy. Ships as "Fuel Performance Nutrition".',
  tagline: 'A bold, data-driven template for sports & performance nutrition — book consults from day one.',
  industry: 'Nutrition',
  sortWeight: 19,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'Fuel Performance Nutrition', tagline: 'Fuel like your results depend on it.' },
  theme: fuel,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Fuel Performance Nutrition — sports dietitians',
      description:
        'Fuel Performance Nutrition is a sports & performance nutrition practice: data-driven fueling plans, body-composition testing and sport-specific consults with board-certified sports dietitians. Book online.',
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
