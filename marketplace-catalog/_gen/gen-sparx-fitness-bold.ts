// sparx-fitness-bold — "Forge", a HIGH-ENERGY strength & conditioning studio.
//
// The loud, kinetic opposite of the warm-yoga sibling: a near-black charcoal ground,
// an ELECTRIC volt-green primary and a bold condensed display face over a clean sans.
// Dark in BOTH modes, tight radii, attitude-first. It sells a real training operation —
// small-group STRENGTH / HIIT / METCON / FOUNDATIONS / CONDITIONING classes booked by
// CAPACITY, plus 1:1 personal training booked by appointment. Same booking spine as the
// salon template, a radically different business: show up, get strong, no ego.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-fitness-bold.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-fitness-bold/**" \
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
  galleryStrip,
  photoHero,
  serviceMenu,
  splitFeature,
  STATUS_ON_DARK,
  teamRow,
  testimonial,
  typeHero,
  type ServiceSiteSpec,
} from './service-sites/harness';

// ── Imagery (swap-ready; each id also names an entry in ASSETS) ────────────────────
const IMG = {
  hero: 'fitness-bold-hero',
  floor: 'fitness-bold-floor',
  rig: 'fitness-bold-rig',
  marcus: 'fitness-bold-marcus',
  deja: 'fitness-bold-deja',
  theo: 'fitness-bold-theo',
  rae: 'fitness-bold-rae',
  action1: 'fitness-bold-action1',
  action2: 'fitness-bold-action2',
  action3: 'fitness-bold-action3',
} as const;

const PHOTO: Record<string, string> = {
  "forge-hero": "https://images.unsplash.com/photo-1689877020200-403d8542d95d?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c3RyZW5ndGglMjB0cmFpbmluZyUyMGd5bXxlbnwwfDB8fHwxNzg2Mzg3NDUyfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "forge-floor": "https://images.unsplash.com/photo-1597076537061-a6b58163aa45?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Z3ltJTIwaW50ZXJpb3IlMjB3ZWlnaHRzfGVufDB8MHx8fDE3ODYzODc0NTV8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "forge-rig": "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d2VpZ2h0bGlmdGluZyUyMGJhcmJlbGx8ZW58MHwwfHx8MTc4NjM4NzQ1OXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "forge-deja": "https://images.unsplash.com/photo-1535469618671-e58a8c365cbd?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Zml0bmVzcyUyMHRyYWluZXIlMjBwb3J0cmFpdCUyMHdvbWFufGVufDB8MHx8fDE3ODYzODc0NjR8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "forge-theo": "https://images.unsplash.com/photo-1599242460737-5174dba06145?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YXRobGV0aWMlMjBtYW4lMjBwb3J0cmFpdHxlbnwwfDB8fHwxNzg2Mzg3NDY3fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "forge-rae": "https://images.unsplash.com/photo-1607286908165-b8b6a2874fc4?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YXRobGV0aWMlMjB3b21hbiUyMHBvcnRyYWl0fGVufDB8MHx8fDE3ODYzODc0NzB8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "forge-action1": "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y3Jvc3NmaXQlMjB3b3Jrb3V0fGVufDB8MHx8fDE3ODYzODc0NzR8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "forge-action2": "https://images.unsplash.com/photo-1601422407692-ec4eeec1d9b3?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8a2V0dGxlYmVsbCUyMHdvcmtvdXR8ZW58MHwwfHx8MTc4NjM4NzQ3Nnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "forge-action3": "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Z3ltJTIwdHJhaW5pbmclMjBpbnRlbnNlfGVufDB8MHx8fDE3ODYzODc0Nzl8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "forge-marcus": "https://images.unsplash.com/photo-1578924608828-79a71150f711?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bWFsZSUyMGF0aGxldGUlMjBneW0lMjBwb3J0cmFpdHxlbnwwfDB8fHwxNzg2Mzg3NTU4fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (seed: string): string =>
  PHOTO[seed] ?? `https://picsum.photos/seed/${seed}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}
const ASSETS: Asset[] = [
  { id: IMG.hero, url: src('forge-hero'), alt: 'A lifter mid-set under a loaded barbell in a dark gym' },
  { id: IMG.floor, url: src('forge-floor'), alt: 'The open training floor with racks, plates and turf' },
  { id: IMG.rig, url: src('forge-rig'), alt: 'A row of squat rigs loaded and ready' },
  { id: IMG.marcus, url: src('forge-marcus'), alt: 'Marcus Vane, head strength coach' },
  { id: IMG.deja, url: src('forge-deja'), alt: 'Déja Okafor, conditioning coach' },
  { id: IMG.theo, url: src('forge-theo'), alt: 'Theo Marsh, foundations coach' },
  { id: IMG.rae, url: src('forge-rae'), alt: 'Rae Calloway, strength & personal-training coach' },
  { id: IMG.action1, url: src('forge-action1'), alt: 'An athlete slamming a heavy rope in a metcon set' },
  { id: IMG.action2, url: src('forge-action2'), alt: 'A small group hitting kettlebell swings together' },
  { id: IMG.action3, url: src('forge-action3'), alt: 'Chalked hands gripping a deadlift bar' },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-fitness-bold: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "forge": near-black charcoal ground, electric volt-green primary, hot-orange ─
//    accent, bold condensed display. DARK IN BOTH MODES (both blocks are dark palettes),
//    tight radii — this is a loud brand, not a themeable-to-white one.
const forge = defineTheme({
  name: 'forge',
  type: { body: face('Inter', 'sans-serif'), head: face('Oswald', 'sans-serif') },
  shape: { selector: '0.125rem', field: '0.125rem', box: '0.25rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(18% 0.012 150)', // near-black charcoal, faint green cast
      'oklch(22% 0.014 150)', // raised charcoal
      'oklch(28% 0.016 150)', // hairline / border
      'oklch(96% 0.01 150)', // bright ink
    ],
    roles: {
      primary: 'oklch(86% 0.23 132)', // electric volt-green
      secondary: 'oklch(72% 0.03 150)', // cool grey-green
      accent: 'oklch(72% 0.19 48)', // hot orange
      neutral: 'oklch(30% 0.014 150)',
      ...STATUS_ON_DARK,
    },
  },
  dark: {
    surfaces: [
      'oklch(15% 0.012 150)',
      'oklch(19% 0.014 150)',
      'oklch(25% 0.016 150)',
      'oklch(97% 0.008 150)',
    ],
    roles: {
      primary: 'oklch(88% 0.24 132)',
      secondary: 'oklch(76% 0.03 150)',
      accent: 'oklch(76% 0.2 48)',
      neutral: 'oklch(28% 0.014 150)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the booking spine (class caps + coaches + the floor as resources) ─────
const hours = (days: number[], startMinute: number, endMinute: number) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

const SCHEDULING = {
  policies: [
    {
      handle: 'class-standard',
      name: 'Class booking',
      depositType: 'none',
      cancellationWindowHours: 8,
      reminderOffsetsMin: [1440, 120],
      policyText:
        'Class spots are capped, so cancel at least 8 hours out to free your place for someone on the waitlist. We remind you the day before and two hours ahead.',
    },
    {
      handle: 'pt-hold',
      name: 'Personal-training hold',
      depositType: 'card_hold',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [2880, 1440, 120],
      policyText:
        'One-to-one sessions place a card hold to lock your coach’s time. Reschedule with 24 hours’ notice and nothing is charged; no-shows forfeit the hold.',
    },
  ],
  resources: [
    {
      handle: 'marcus',
      name: 'Marcus Vane',
      kind: 'staff',
      skillTags: ['strength', 'powerlifting', 'pt'],
      windows: [...hours([1, 3, 5], 330, 660), ...hours([1, 3, 5], 960, 1230)], // Mon/Wed/Fri 5:30–11 & 4–8:30
    },
    {
      handle: 'deja',
      name: 'Déja Okafor',
      kind: 'staff',
      skillTags: ['hiit', 'metcon', 'conditioning'],
      windows: [...hours([2, 4], 330, 660), ...hours([2, 4, 6], 960, 1230)], // Tue/Thu AM, Tue/Thu/Sat PM
    },
    {
      handle: 'theo',
      name: 'Theo Marsh',
      kind: 'staff',
      skillTags: ['foundations', 'mobility', 'pt'],
      windows: [...hours([1, 2, 3, 4, 5], 600, 900)], // weekday mid-morning to afternoon 10–3
    },
    {
      handle: 'rae',
      name: 'Rae Calloway',
      kind: 'staff',
      skillTags: ['strength', 'conditioning', 'pt'],
      windows: [...hours([2, 4, 6], 330, 660), ...hours([1, 3, 5], 960, 1260)], // early AMs + weekday evenings
    },
    {
      handle: 'floor',
      name: 'Training floor',
      kind: 'space',
      skillTags: ['floor'],
      windows: hours([1, 2, 3, 4, 5, 6, 0], 300, 1260), // the room is open 5:00–21:00 every day
    },
  ],
  services: [
    {
      handle: 'strength',
      name: 'Strength',
      description:
        'Barbell strength in a capped small group — squat, press, pull, hinge. Every set coached, every load scaled to you. Come for the numbers, stay for the people chasing them with you.',
      bookingType: 'class',
      capacity: 14,
      durationMinutes: 60,
      priceCents: 3000,
      assignmentStrategy: 'collective',
      resourceRequirements: [
        { role: 'coach', kind: 'staff', skillTags: ['strength'], count: 1 },
        { role: 'floor', kind: 'space', skillTags: ['floor'], count: 1 },
      ],
      policyHandle: 'class-standard',
    },
    {
      handle: 'hiit',
      name: 'HIIT',
      description:
        'Forty-five loud minutes of intervals — bike, rower, bells and bodyweight, hard work and full recoveries. You pick the intensity, we hold the clock.',
      bookingType: 'class',
      capacity: 16,
      durationMinutes: 45,
      priceCents: 2800,
      assignmentStrategy: 'collective',
      resourceRequirements: [
        { role: 'coach', kind: 'staff', skillTags: ['hiit'], count: 1 },
        { role: 'floor', kind: 'space', skillTags: ['floor'], count: 1 },
      ],
      policyHandle: 'class-standard',
    },
    {
      handle: 'metcon',
      name: 'Metcon',
      description:
        'Mixed-modal conditioning — the classic "workout of the day". Lifts, carries and cardio stitched into one score you chase week over week.',
      bookingType: 'class',
      capacity: 12,
      durationMinutes: 45,
      priceCents: 2800,
      assignmentStrategy: 'collective',
      resourceRequirements: [
        { role: 'coach', kind: 'staff', skillTags: ['metcon'], count: 1 },
        { role: 'floor', kind: 'space', skillTags: ['floor'], count: 1 },
      ],
      policyHandle: 'class-standard',
    },
    {
      handle: 'foundations',
      name: 'Foundations',
      description:
        'New to the barbell? Start here. A small, unhurried group that drills the six core lifts until they feel like yours — no ego, no rush, no assumed experience.',
      bookingType: 'class',
      capacity: 10,
      durationMinutes: 45,
      priceCents: 2500,
      assignmentStrategy: 'collective',
      resourceRequirements: [
        { role: 'coach', kind: 'staff', skillTags: ['foundations'], count: 1 },
        { role: 'floor', kind: 'space', skillTags: ['floor'], count: 1 },
      ],
      policyHandle: 'class-standard',
    },
    {
      handle: 'conditioning',
      name: 'Engine',
      description:
        'A thirty-minute pure-conditioning hit — steady intervals that build the engine under everything else. Quick, brutal, done before the day starts.',
      bookingType: 'class',
      capacity: 16,
      durationMinutes: 30,
      priceCents: 2500,
      assignmentStrategy: 'collective',
      resourceRequirements: [
        { role: 'coach', kind: 'staff', skillTags: ['conditioning'], count: 1 },
        { role: 'floor', kind: 'space', skillTags: ['floor'], count: 1 },
      ],
      policyHandle: 'class-standard',
    },
    {
      handle: 'personal-training',
      name: '1:1 Personal training',
      description:
        'You and a coach, a plan built around your goals and your schedule. Pick the coach you want and the time that fits — technique, programming and someone in your corner every rep.',
      bookingType: 'appointment',
      capacity: 1,
      durationMinutes: 60,
      priceCents: 8500,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'coach', kind: 'staff', skillTags: ['pt'], count: 1 }],
      policyHandle: 'pt-hold',
    },
    {
      handle: 'intro-assessment',
      name: 'Free intro & assessment',
      description:
        'Never trained here? Book a free session — movement screen, goal chat and a walk of the floor so your first class isn’t your first guess. We confirm it once we see it land.',
      bookingType: 'appointment',
      capacity: 1,
      durationMinutes: 30,
      priceCents: 0,
      requiresApproval: true,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'coach', kind: 'staff', skillTags: ['pt'], count: 1 }],
      policyHandle: 'pt-hold',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  typeHero({
    title: 'Show up. Get strong. No ego.',
    sub: 'A strength & conditioning studio built on small groups, real coaching and loads that meet you where you are. Every level scaled. Every session coached. Claim your spot.',
    primary: { label: 'Claim your spot', href: '/book' },
    secondary: { label: 'See the board', href: '/book' },
    surface: 'primary',
  }),
  featureRow({
    items: [
      {
        title: 'Coaches, not a playlist',
        body: 'Every class is run by a certified coach who watches your reps, scales the load and knows your name — not a screen counting you down.',
      },
      {
        title: 'Small groups, hard caps',
        body: 'Classes are capped so you always have space, a barbell and eyes on your form. No fighting for a rack, no getting lost in a crowd.',
      },
      {
        title: 'Every level scaled',
        body: 'First week or tenth year, the workout bends to you. We scale the weight and the movement so it’s the right kind of hard for your body today.',
      },
    ],
  }),
  splitFeature({
    image: url(IMG.floor),
    alt: 'The open training floor with racks, plates and turf',
    heading: 'Real programming, not random punishment',
    body: [
      'Forge runs on a written plan that builds week over week — strength blocks that add load on purpose, conditioning that grows an engine, and deloads before you need them.',
      'You’ll see your numbers move because we track them. Nothing here is a bootcamp free-for-all designed to smoke you and forget you.',
    ],
    cta: { label: 'Start free', href: '/book' },
  }),
  serviceMenu({
    heading: 'The board',
    intro: 'Book a class by capacity or a coach one-to-one. Live times, spots left and full pricing are on the booking page.',
    surface: 'muted',
    columns: 3,
    items: [
      { name: 'Strength', priceCents: 3000, durationMin: 60, desc: 'Barbell strength, coached, capped at 14.' },
      { name: 'HIIT', priceCents: 2800, durationMin: 45, desc: 'Loud intervals, full recoveries, your intensity.' },
      { name: 'Metcon', priceCents: 2800, durationMin: 45, desc: 'Mixed-modal conditioning with a score to chase.' },
      { name: 'Foundations', priceCents: 2500, durationMin: 45, desc: 'The six core lifts, drilled from zero.' },
      { name: 'Engine', priceCents: 2500, durationMin: 30, desc: 'Thirty minutes of pure conditioning.' },
      { name: '1:1 Personal training', priceCents: 8500, durationMin: 60, desc: 'Your coach, your plan, your schedule.' },
    ],
    cta: { label: 'See the schedule & book', href: '/book' },
  }),
  teamRow({
    heading: 'Your coaches',
    intro: 'The people under the bar with you. Book a class or grab any of them for 1:1.',
    members: [
      { name: 'Marcus Vane', role: 'Head strength coach', image: url(IMG.marcus), alt: 'Marcus Vane, head strength coach', bio: 'Powerlifting background, obsessed with clean technique and slow, stubborn PRs.' },
      { name: 'Déja Okafor', role: 'Conditioning coach', image: url(IMG.deja), alt: 'Déja Okafor, conditioning coach', bio: 'Runs the HIIT, Metcon and Engine floors — the loudest, most contagious energy in the room.' },
      { name: 'Theo Marsh', role: 'Foundations coach', image: url(IMG.theo), alt: 'Theo Marsh, foundations coach', bio: 'Gets nervous first-timers under a barbell and grinning by the end of week one.' },
      { name: 'Rae Calloway', role: 'Strength & PT coach', image: url(IMG.rae), alt: 'Rae Calloway, strength & personal-training coach', bio: 'Strength and hybrid conditioning; builds the 1:1 plans people actually stick to.' },
    ],
  }),
  galleryStrip({
    heading: 'Inside the room',
    surface: 'muted',
    columns: 3,
    images: [
      { src: url(IMG.action1), alt: 'An athlete slamming a heavy rope in a metcon set' },
      { src: url(IMG.action2), alt: 'A small group hitting kettlebell swings together' },
      { src: url(IMG.action3), alt: 'Chalked hands gripping a deadlift bar' },
    ],
  }),
  testimonial({
    quote: 'Walked in twelve weeks ago unable to squat the empty bar. Hit 135 for five today and the whole class lost their minds for me. That’s Forge — you get strong and nobody lets you do it quietly.',
    attribution: 'Devon, member since this spring',
    surface: 'primary',
  }),
  bookingCta({
    title: 'Your first session is on us',
    sub: 'Book the free intro, meet a coach and see the floor. No membership, no pressure — just show up.',
    cta: { label: 'Claim your spot', href: '/book' },
  }),
];

const BOOK_INTRO = [
  photoHero({
    image: url(IMG.rig),
    alt: 'A row of squat rigs loaded and ready',
    title: 'Book your session',
    sub: 'Pick a class to see live times and spots left, or book a coach one-to-one. New here? Start with the free intro.',
    primary: { label: 'See the board below', href: '/book' },
    overlay: 'darker',
    align: 'start',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.hero),
    alt: 'A lifter mid-set under a loaded barbell in a dark gym',
    heading: 'Built for people, not personal records they’ll never chase',
    body: [
      'Forge started because the big-box gym wasn’t working — no coaching, no plan, no one who noticed if you showed up or quit. So we built the opposite: small groups, real programming, and coaches who know your name and your numbers.',
      'Strong isn’t a look here, it’s a habit. We keep classes capped and the ego at the door so the person on their first day trains next to the person on their thousandth, and both leave better than they came.',
    ],
    cta: { label: 'Start free', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'How we train',
    items: [
      { title: 'Coached every rep', body: 'A certified coach runs every session — cueing form, scaling load and keeping you honest. You’re never just clocking time on a machine.' },
      { title: 'Programmed on purpose', body: 'Strength that adds weight over blocks, conditioning that builds an engine, deloads before you’re fried. It’s written, tracked and it moves your numbers.' },
      { title: 'Scaled for you', body: 'Every workout scales up or down on the spot. Injury, first week, off day — we adjust the movement and the load so it’s the right hard for you.' },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Find the floor',
    address: ['Forge Strength & Conditioning', '414 Foundry Ave', 'Unit B · Denver, CO 80216'],
    mapLocation: '414 Foundry Ave, Denver, CO 80216',
    hours: [
      { day: 'Monday – Friday', time: '5:00 – 21:00' },
      { day: 'Saturday', time: '7:00 – 15:00' },
      { day: 'Sunday', time: '8:00 – 13:00' },
      { day: 'Staffed coaching', time: 'See class times' },
    ],
  }),
  bookingCta({
    title: 'Stop scrolling. Start lifting.',
    sub: 'Book the free intro online and pick a time this week — no phone call, no sales pitch.',
    surface: 'muted',
    cta: { label: 'Book online', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-fitness-bold',
  name: 'sparx — Fitness (Bold)',
  summary:
    'A dark, electric strength & conditioning studio site — near-black charcoal ground, a volt-green primary and a bold condensed display. Installs a working booking flow: capacity-based GROUP CLASSES (strength, HIIT, metcon, foundations, conditioning) with per-class caps, plus 1:1 personal training and a free intro assessment. Coaches and the gym floor are bookable resources with early-morning and evening hours. Ships as "Forge".',
  tagline: 'A loud, high-energy template for gyms & studios — book classes and 1:1s from day one.',
  industry: 'Fitness studio',
  sortWeight: 81,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'Forge', tagline: 'Show up. Get strong. No ego.' },
  theme: forge,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Forge — strength & conditioning studio',
      description:
        'Forge is a small-group strength & conditioning studio: coached classes, real programming and 1:1 personal training. Book your free intro online.',
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
