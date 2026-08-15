// sparx-massage-sanctuary — "Stillwater", a serene relaxation-massage RETREAT.
//
// Pure calm, ritual and softness — the warm, atmospheric massage lane, deliberately the
// OPPOSITE of the clinical/therapeutic massage template (which is cool, precise and
// outcome-led). Stillwater leads with FEELING: unwind, restore, breathe. Warm sand and
// oat grounds, a soft sage-green primary, a clay accent, and a serif display over a
// humanist sans — an hour that dissolves, not a treatment plan. Same booking spine as the
// rest of the service family; a different business.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-massage-sanctuary.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-massage-sanctuary/**" \
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
  STATUS_ON_LIGHT,
  testimonial,
  type ServiceSiteSpec,
} from './service-sites/harness';

// ── Imagery (swap-ready; each id also names an entry in ASSETS) ────────────────────
const IMG = {
  hero: 'massage-sanctuary-hero',
  ritual: 'massage-sanctuary-ritual',
  sanctuary: 'massage-sanctuary-sanctuary',
  calm1: 'massage-sanctuary-calm1',
  calm2: 'massage-sanctuary-calm2',
  calm3: 'massage-sanctuary-calm3',
} as const;

const PHOTO: Record<string, string> = {
  "stillwater-hero": "https://images.unsplash.com/photo-1600334089648-b0d9d3028eb2?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c3BhJTIwbWFzc2FnZSUyMHJlbGF4YXRpb258ZW58MHwwfHx8MTc4NjM4NzQxNHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "stillwater-ritual": "https://images.unsplash.com/photo-1591020330942-e9c3bce82096?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c3BhJTIwc3RvbmVzJTIwY2FuZGxlc3xlbnwwfDB8fHwxNzg2Mzg3NDE3fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "stillwater-sanctuary": "https://images.unsplash.com/photo-1630835425197-50feeba99ecd?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c3BhJTIwaW50ZXJpb3IlMjBjYWxtfGVufDB8MHx8fDE3ODYzODc0MjB8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "stillwater-calm1": "https://images.unsplash.com/photo-1665824249476-a7951ab0aaaa?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c3BhJTIwY2FuZGxlcyUyMGZsb3dlcnN8ZW58MHwwfHx8MTc4NjM4NzQyM3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "stillwater-calm2": "https://images.unsplash.com/photo-1540555700478-4be289fbecef?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c3BhJTIwdG93ZWxzJTIwd2VsbG5lc3N8ZW58MHwwfHx8MTc4NjM4NzQyN3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "stillwater-calm3": "https://images.unsplash.com/photo-1515377905703-c4788e51af15?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YXJvbWF0aGVyYXB5JTIwb2lsc3xlbnwwfDB8fHwxNzg2Mzg3NDMwfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
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
    url: src('stillwater-hero'),
    alt: 'A dim, candlelit treatment room with warm towels and soft light',
  },
  {
    id: IMG.ritual,
    url: src('stillwater-ritual'),
    alt: 'Warm oil and smooth stones laid out on folded linen',
  },
  {
    id: IMG.sanctuary,
    url: src('stillwater-sanctuary'),
    alt: 'A quiet lounge with low light, plants and a pot of tea',
  },
  {
    id: IMG.calm1,
    url: src('stillwater-calm1'),
    alt: 'A made massage table under a window with sheer curtains',
  },
  {
    id: IMG.calm2,
    url: src('stillwater-calm2'),
    alt: 'A shelf of essential oils and a single lit candle',
  },
  {
    id: IMG.calm3,
    url: src('stillwater-calm3'),
    alt: 'Folded warm towels and a bowl of water with floating petals',
  },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-massage-sanctuary: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "stillwater": warm-sand ground, sage-green primary, clay accent, serif display ─
const stillwater = defineTheme({
  name: 'stillwater',
  type: { body: face('Inter', 'sans-serif'), head: face('Fraunces', 'serif') },
  shape: { selector: '0.75rem', field: '0.75rem', box: '1rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(96% 0.013 85)', // warm sand
      'oklch(92% 0.017 82)', // oat
      'oklch(87% 0.02 80)', // warm hairline
      'oklch(29% 0.02 150)', // deep sage-charcoal ink
    ],
    roles: {
      primary: 'oklch(62% 0.058 150)', // soft sage green
      secondary: 'oklch(44% 0.02 95)', // warm taupe
      accent: 'oklch(64% 0.11 45)', // warm clay
      neutral: 'oklch(30% 0.015 130)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(24% 0.014 150)',
      'oklch(20% 0.011 150)',
      'oklch(16% 0.009 150)',
      'oklch(93% 0.013 85)',
    ],
    roles: {
      primary: 'oklch(73% 0.07 150)',
      secondary: 'oklch(76% 0.016 90)',
      accent: 'oklch(72% 0.1 45)',
      neutral: 'oklch(83% 0.012 130)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the booking spine (policies, therapists + rooms + hours, the menu) ──────
const hours = (days: number[], startMinute: number, endMinute: number) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

const SCHEDULING = {
  policies: [
    {
      handle: 'stillwater-standard',
      name: 'Standard booking',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [1440, 120],
      policyText:
        'Please give us 24 hours’ notice to change or cancel. We’ll send a gentle reminder the day before and two hours ahead so nothing sneaks up on you.',
    },
    {
      handle: 'ritual-deposit',
      name: 'Ritual & couples deposit',
      depositType: 'deposit',
      depositAmountCents: 3000,
      cancellationWindowHours: 48,
      reminderOffsetsMin: [2880, 1440, 120],
      policyText:
        'Longer rituals and couples rooms hold a $30 deposit that comes off your total. Reschedule with 48 hours’ notice and it carries over to your next visit.',
    },
  ],
  resources: [
    {
      handle: 'maren',
      name: 'Maren Voss',
      kind: 'staff',
      skillTags: ['swedish', 'hot-stone', 'aromatherapy', 'couples'],
      windows: hours([2, 3, 4, 5, 6], 600, 1200), // Tue–Sat 10–8
    },
    {
      handle: 'ione',
      name: 'Ione Bellamy',
      kind: 'staff',
      skillTags: ['swedish', 'prenatal', 'ritual', 'aromatherapy'],
      windows: hours([3, 4, 5, 6, 0], 600, 1140), // Wed–Sun 10–7
    },
    {
      handle: 'delphine',
      name: 'Delphine Marchetti',
      kind: 'staff',
      skillTags: ['deep-tissue', 'hot-stone', 'ritual', 'couples'],
      windows: hours([2, 4, 5, 6, 0], 660, 1200), // Tue, Thu–Sun 11–8
    },
    {
      handle: 'room-linden',
      name: 'The Linden Room',
      kind: 'space',
      skillTags: ['room'],
      windows: hours([2, 3, 4, 5, 6, 0], 600, 1200), // Tue–Sun 10–8
    },
    {
      handle: 'room-cedar',
      name: 'The Cedar Room',
      kind: 'space',
      skillTags: ['room'],
      windows: hours([2, 3, 4, 5, 6, 0], 600, 1200),
    },
    {
      handle: 'suite-stillwater',
      name: 'The Stillwater Suite',
      kind: 'space',
      skillTags: ['couples-suite', 'room'],
      windows: hours([3, 4, 5, 6, 0], 600, 1200), // Wed–Sun 10–8
    },
  ],
  services: [
    {
      handle: 'swedish-60',
      name: 'Swedish relaxation · 60 min',
      description:
        'Long, slow, flowing strokes that quiet a busy mind and let the whole body soften. Our most-loved unwind.',
      durationMinutes: 60,
      priceCents: 11000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'therapist', kind: 'staff', skillTags: ['swedish'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['room'], count: 1 },
      ],
      policyHandle: 'stillwater-standard',
    },
    {
      handle: 'swedish-90',
      name: 'Swedish relaxation · 90 min',
      description:
        'The full unhurried hour and a half — nowhere to be, nothing to do, every knot given the time it needs to let go.',
      durationMinutes: 90,
      priceCents: 15500,
      bufferAfterMin: 10,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'therapist', kind: 'staff', skillTags: ['swedish'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['room'], count: 1 },
      ],
      policyHandle: 'stillwater-standard',
    },
    {
      handle: 'hot-stone',
      name: 'Warm stone massage · 90 min',
      description:
        'Smooth, sun-warm stones melt tension before a hand ever presses. Deep, radiant heat that reaches what pressure alone can’t.',
      durationMinutes: 90,
      priceCents: 17000,
      bufferAfterMin: 15,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'therapist', kind: 'staff', skillTags: ['hot-stone'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['room'], count: 1 },
      ],
      policyHandle: 'stillwater-standard',
    },
    {
      handle: 'aromatherapy',
      name: 'Aromatherapy massage · 75 min',
      description:
        'You choose the blend — calm, restore or breathe — and we work it in with slow, grounding pressure. You’ll carry the quiet home with you.',
      durationMinutes: 75,
      priceCents: 14000,
      bufferAfterMin: 10,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'therapist', kind: 'staff', skillTags: ['aromatherapy'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['room'], count: 1 },
      ],
      policyHandle: 'stillwater-standard',
    },
    {
      handle: 'scalp-face',
      name: 'Warm scalp & face ritual · 60 min',
      description:
        'Warm oil worked through the scalp, then a slow face and neck release. The one you book when you can’t switch your head off.',
      durationMinutes: 60,
      priceCents: 12500,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'therapist', kind: 'staff', skillTags: ['aromatherapy'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['room'], count: 1 },
      ],
      policyHandle: 'stillwater-standard',
    },
    {
      handle: 'stillwater-ritual',
      name: 'The Stillwater ritual · 120 min',
      description:
        'Our signature two hours: a warm foot soak, a full aromatherapy massage, warm stones and a scalp finish. A whole afternoon that dissolves.',
      durationMinutes: 120,
      priceCents: 24000,
      bufferAfterMin: 20,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'therapist', kind: 'staff', skillTags: ['ritual'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['room'], count: 1 },
      ],
      policyHandle: 'ritual-deposit',
    },
    {
      handle: 'couples-retreat',
      name: 'Couples massage · 90 min',
      description:
        'Two therapists, one candlelit suite, side by side. Arrive together, breathe out together — the most-gifted hour on the menu.',
      durationMinutes: 90,
      priceCents: 32000,
      bufferAfterMin: 20,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'therapist', kind: 'staff', skillTags: ['couples'], count: 2 },
        { role: 'suite', kind: 'space', skillTags: ['couples-suite'], count: 1 },
      ],
      policyHandle: 'ritual-deposit',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  photoHero({
    image: url(IMG.hero),
    alt: 'A dim, candlelit treatment room with warm towels and soft light',
    title: 'An hour that dissolves',
    sub: 'Stillwater is a quiet massage retreat built for one thing — letting you put everything down. Warm light, soft hands, and nowhere else to be.',
    primary: { label: 'Book your escape', href: '/book' },
    secondary: { label: 'See the menu', href: '/book' },
    overlay: 'soft',
  }),
  splitFeature({
    image: url(IMG.ritual),
    alt: 'Warm oil and smooth stones laid out on folded linen',
    heading: 'What an hour here feels like',
    body: [
      'You arrive to warm tea and a room already dim and quiet. No forms to rush through, no small talk you don’t want. Just a slow start and a therapist who lets the hour set its own pace.',
      'Warm oil, unhurried pressure, and the particular stillness that only comes when someone else is minding the time for once. You leave loose, warm, and a little further from the morning than you thought possible.',
    ],
    cta: { label: 'Reserve a room', href: '/book' },
  }),
  serviceMenu({
    heading: 'The menu',
    intro: 'A short, considered list — nothing rushed, nothing clinical. Live availability and full prices are on the booking page.',
    surface: 'muted',
    columns: 2,
    items: [
      { name: 'Swedish relaxation · 60 min', priceCents: 11000, durationMin: 60, desc: 'Slow, flowing strokes to quiet the mind.' },
      { name: 'Warm stone massage · 90 min', priceCents: 17000, durationMin: 90, desc: 'Sun-warm stones melt tension first.' },
      { name: 'The Stillwater ritual · 120 min', priceCents: 24000, durationMin: 120, desc: 'Foot soak, aromatherapy, stones, scalp.' },
      { name: 'Couples massage · 90 min', priceCents: 32000, durationMin: 90, desc: 'Two therapists, one candlelit suite.' },
    ],
    cta: { label: 'See everything & book', href: '/book' },
  }),
  featureRow({
    heading: 'The small things that make it soft',
    items: [
      {
        title: 'Quiet, low-lit rooms',
        body: 'Sound-softened, candle-warm and yours alone. The phone stays in the locker — the hour belongs to you.',
      },
      {
        title: 'Warm towels, warm oil',
        body: 'Everything that touches you is heated first. It’s a small thing that changes the whole hour.',
      },
      {
        title: 'No rushing, ever',
        body: 'We build in real time between guests, so you’re never hurried off the table or into the next thing.',
      },
    ],
  }),
  galleryStrip({
    heading: 'Inside the sanctuary',
    surface: 'muted',
    columns: 3,
    images: [
      { src: url(IMG.calm1), alt: 'A made massage table under a window with sheer curtains' },
      { src: url(IMG.calm2), alt: 'A shelf of essential oils and a single lit candle' },
      { src: url(IMG.calm3), alt: 'Folded warm towels and a bowl of water with floating petals' },
    ],
  }),
  testimonial({
    quote: 'I came in wound tight and left feeling like myself again. I don’t remember the last time I was that unhurried. I’ve already booked the next one.',
    attribution: 'Renata, guest since 2024',
  }),
  bookingCta({
    title: 'Give yourself the hour',
    sub: 'Choose a treatment, pick your therapist and room, and see live times. It takes about a minute — the rest is rest.',
    cta: { label: 'Book online', href: '/book' },
  }),
];

const BOOK_INTRO = [
  photoHero({
    image: url(IMG.sanctuary),
    alt: 'A quiet lounge with low light, plants and a pot of tea',
    title: 'Book your time',
    sub: 'Choose a treatment to see prices and how long it takes, then pick your therapist, your room, and a time that’s yours.',
    primary: { label: 'See treatments below', href: '/book' },
    overlay: 'dark',
    align: 'start',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.sanctuary),
    alt: 'A quiet lounge with low light, plants and a pot of tea',
    heading: 'About Stillwater',
    body: [
      'We opened Stillwater because rest had started to feel like something you had to earn. We wanted a room where you didn’t — where the light was already low, the towels already warm, and no one was watching the clock but us.',
      'It’s a small retreat on purpose. A handful of rooms, a few therapists who’ve worked together for years, and a pace that never speeds up. Come as you are, tired as you are. That’s exactly who this is for.',
    ],
    cta: { label: 'Book a room', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'How we hold the space',
    items: [
      { title: 'One guest at a time', body: 'Your room, your hour, your quiet. We never double-book a therapist or hurry the changeover between guests.' },
      { title: 'Gentle, plant-based care', body: 'Warm oils and essential blends we’d use ourselves — nothing harsh, nothing you’ll smell all day unless you want to.' },
      { title: 'You set the pressure', body: 'Deep or feather-light, chatty or silent — you tell us at the start, and we follow it the whole way through.' },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Find the sanctuary',
    address: ['Stillwater Massage Retreat', '9 Willow Court', 'Garden Level · Asheville, NC 28801'],
    mapLocation: '9 Willow Court, Asheville, NC 28801',
    hours: [
      { day: 'Tuesday – Saturday', time: '10:00 – 8:00' },
      { day: 'Sunday', time: '10:00 – 7:00' },
      { day: 'Monday', time: 'Closed' },
    ],
  }),
  bookingCta({
    title: 'Rather book than call?',
    sub: 'See live availability and reserve your room online — no phone tag, no waiting on hold.',
    surface: 'muted',
    cta: { label: 'Book online', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-massage-sanctuary',
  name: 'Massage (Sanctuary)',
  summary:
    'A serene relaxation-massage retreat site — warm sand and oat grounds, a soft sage-green primary, a clay accent and a serif display, with dim, candlelit photography carrying the page. Installs a working booking flow: a calm treatment menu (Swedish, warm stone, aromatherapy, the signature Stillwater ritual, couples), three therapists and three rooms (incl. a couples suite) you book by name, and a deposit policy on longer rituals. Ships as "Stillwater".',
  tagline: 'A warm, serene template for massage & wellness — book online from day one.',
  industry: 'Massage therapy',
  sortWeight: 83,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'Stillwater', tagline: 'Rest, restored.' },
  theme: stillwater,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Stillwater — a serene massage retreat',
      description:
        'Stillwater is a quiet massage retreat for Swedish, warm stone and aromatherapy massage, a signature two-hour ritual and couples rooms. Book your therapist online.',
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
