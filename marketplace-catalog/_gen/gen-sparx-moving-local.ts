// sparx-moving-local — "Sure Hands Moving", a friendly LOCAL residential mover.
//
// The reliable, everyday, been-in-the-neighborhood moving company (the Bellhop / two-guys-
// and-a-truck lane, done right): a clean off-white ground, a confident green primary and a
// warm amber accent, a sturdy friendly sans display, and real photography of movers and a
// truck carrying the page. Upfront flat quotes, careful insured crews, movers who actually
// show up. The functional core is BOOKING A FREE ESTIMATE — a homeowner books a free
// estimate or an in-home walkthrough online and gets a real time slot, exactly how a modern
// mover runs its schedule. Deliberately the FRIENDLY LOCAL sibling of the separate premium
// long-distance white-glove moving template — same booking spine, an everyday personality.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-moving-local.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-moving-local/**" \
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
  hero: 'moving-local-hero',
  careful: 'moving-local-careful',
  jordan: 'moving-local-jordan',
  tasha: 'moving-local-tasha',
  luis: 'moving-local-luis',
} as const;

const PHOTO: Record<string, string> = {
  "surehands-hero": "https://images.unsplash.com/photo-1601467995997-ac1ae9a8fff4?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bW92ZXJzJTIwbW92aW5nJTIwdHJ1Y2t8ZW58MHwwfHx8MTc4NjM5NTE5M3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "surehands-careful": "https://images.unsplash.com/photo-1730154838368-c37b1fdebcf6?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bW92aW5nJTIwYm94ZXMlMjBob21lfGVufDB8MHx8fDE3ODYzOTUxOTZ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "surehands-jordan": "https://images.unsplash.com/flagged/photo-1570612861542-284f4c12e75f?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bW92ZXIlMjBwb3J0cmFpdCUyMG1hbnxlbnwwfDB8fHwxNzg2Mzk1MTk5fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "surehands-tasha": "https://images.unsplash.com/photo-1615464670798-6e92fafa2a89?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjB3b3JrZXIlMjBwb3J0cmFpdHxlbnwwfDB8fHwxNzg2MzkyNjQwfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "surehands-luis": "https://images.unsplash.com/photo-1759521296144-fe6f2d2dc769?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29ya2VyJTIwcG9ydHJhaXQlMjB1bmlmb3JtfGVufDB8MHx8fDE3ODYzODkyNjJ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
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
    url: src('surehands-hero'),
    alt: 'Two uniformed movers carrying a wrapped sofa down a front walk to a loaded truck',
  },
  {
    id: IMG.careful,
    url: src('surehands-careful'),
    alt: 'A mover carefully blanket-wrapping a dresser before loading it',
  },
  { id: IMG.jordan, url: src('surehands-jordan'), alt: 'Jordan Pierce, lead move coordinator' },
  { id: IMG.tasha, url: src('surehands-tasha'), alt: 'Tasha Owens, crew lead and furniture pro' },
  { id: IMG.luis, url: src('surehands-luis'), alt: 'Luis Ferreira, packing and loading lead' },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-moving-local: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "surehands": off-white ground, confident green primary, warm amber accent ──
const surehands = defineTheme({
  name: 'surehands',
  type: { body: face('Inter', 'sans-serif'), head: face('Outfit', 'sans-serif') },
  shape: { selector: '0.5rem', field: '0.5rem', box: '0.75rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(98% 0.006 150)', // clean off-white ground
      'oklch(95% 0.01 150)', // warm paper
      'oklch(90% 0.014 150)', // hairline
      'oklch(24% 0.02 155)', // deep pine ink
    ],
    roles: {
      primary: 'oklch(53% 0.125 155)', // confident, friendly green
      secondary: 'oklch(36% 0.02 155)', // dark pine slate (readable micro-labels on light)
      accent: 'oklch(72% 0.145 58)', // warm amber
      neutral: 'oklch(30% 0.02 155)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(22% 0.02 155)',
      'oklch(18% 0.018 155)',
      'oklch(14% 0.014 155)',
      'oklch(96% 0.006 150)',
    ],
    roles: {
      primary: 'oklch(72% 0.14 155)', // lifted green
      secondary: 'oklch(78% 0.02 150)',
      accent: 'oklch(80% 0.14 62)',
      neutral: 'oklch(80% 0.02 150)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the booking spine (policies, crews + hours, the estimate menu) ────────
const hours = (days: number[], startMinute: number, endMinute: number) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

const SCHEDULING = {
  policies: [
    {
      handle: 'moving-standard',
      name: 'Standard estimate',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [1440, 120],
      policyText:
        'Give us at least 24 hours’ notice to move or cancel your estimate. We text a reminder the day before and confirm your arrival window that morning — estimates are always free and no-obligation.',
    },
    {
      handle: 'move-deposit',
      name: 'Move-date deposit',
      depositType: 'deposit',
      depositAmountCents: 5000,
      cancellationWindowHours: 48,
      reminderOffsetsMin: [2880, 1440, 120],
      policyText:
        'A $50 deposit holds your moving day and comes straight off your final bill. Reschedule with 48 hours’ notice and it moves with you — no penalty, no lost deposit.',
    },
  ],
  resources: [
    {
      handle: 'jordan',
      name: 'Jordan Pierce',
      kind: 'staff',
      skillTags: ['local', 'packing', 'general'],
      windows: hours([1, 2, 3, 4, 5, 6], 480, 1080), // Mon–Sat 8–6
    },
    {
      handle: 'tasha',
      name: 'Tasha Owens',
      kind: 'staff',
      skillTags: ['furniture', 'local', 'general'],
      windows: hours([1, 2, 3, 4, 5], 420, 1020), // Mon–Fri 7–5
    },
    {
      handle: 'luis',
      name: 'Luis Ferreira',
      kind: 'staff',
      skillTags: ['packing', 'loading', 'general'],
      windows: hours([2, 3, 4, 5, 6], 480, 1080), // Tue–Sat 8–6
    },
  ],
  services: [
    {
      handle: 'free-estimate',
      name: 'Free estimate',
      description:
        'Tell us what you’re moving and we’ll come out, look it over and hand you a flat, written price — free, with zero obligation and no pressure to book.',
      durationMinutes: 30,
      priceCents: 0,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'coordinator', kind: 'staff', skillTags: ['general'], count: 1 },
      ],
      policyHandle: 'moving-standard',
    },
    {
      handle: 'in-home-estimate',
      name: 'In-home estimate',
      description:
        'A full walkthrough of your place so nothing gets missed. We measure the big pieces, count the boxes and give you an accurate flat quote on the spot.',
      durationMinutes: 60,
      priceCents: 0,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'coordinator', kind: 'staff', skillTags: ['general'], count: 1 },
      ],
      policyHandle: 'moving-standard',
    },
    {
      handle: 'local-move-consult',
      name: 'Local move planning',
      description:
        'Lock in your moving day for a house or condo move across town. We map out the crew, the truck size and the timing, and hold your date with a small deposit.',
      durationMinutes: 45,
      priceCents: 0,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'coordinator', kind: 'staff', skillTags: ['general'], count: 1 },
      ],
      policyHandle: 'move-deposit',
    },
    {
      handle: 'apartment-move-consult',
      name: 'Apartment move planning',
      description:
        'Stairs, elevators and tight parking, sorted ahead of time. We plan the details that make an apartment move fast, then hold your day with a deposit.',
      durationMinutes: 45,
      priceCents: 0,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'coordinator', kind: 'staff', skillTags: ['general'], count: 1 },
      ],
      policyHandle: 'move-deposit',
    },
    {
      handle: 'packing-service-consult',
      name: 'Packing service planning',
      description:
        'Let us do the boxing. We’ll walk through what needs packing, bring the supplies, and give you a flat price to have it wrapped, boxed and labeled before moving day.',
      durationMinutes: 45,
      priceCents: 0,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'coordinator', kind: 'staff', skillTags: ['packing'], count: 1 },
      ],
      policyHandle: 'moving-standard',
    },
    {
      handle: 'labor-only-consult',
      name: 'Loading help planning',
      description:
        'Got the truck, just need the muscle? Book a crew to load or unload your rental or container. We’ll size the job and quote it flat by the hour.',
      durationMinutes: 30,
      priceCents: 0,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'coordinator', kind: 'staff', skillTags: ['general'], count: 1 },
      ],
      policyHandle: 'moving-standard',
    },
    {
      handle: 'furniture-move-consult',
      name: 'Single-item & furniture move',
      description:
        'One heavy, awkward piece — a piano, a gun safe, a sleeper sofa up three flights. We plan the lift, bring the gear to protect it, and hold your slot with a deposit.',
      durationMinutes: 30,
      priceCents: 0,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'coordinator', kind: 'staff', skillTags: ['general'], count: 1 },
      ],
      policyHandle: 'move-deposit',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  photoHero({
    image: url(IMG.hero),
    alt: 'Two uniformed movers carrying a wrapped sofa down a front walk to a loaded truck',
    title: 'Movers who show up and take care of your stuff',
    sub: 'Local, friendly and fully insured — with flat, upfront quotes and crews that treat your things like their own. Get a free estimate online and we’ll give you a real price before moving day.',
    primary: { label: 'Get a free estimate', href: '/book' },
    secondary: { label: 'See what we move', href: '/book' },
    overlay: 'dark',
  }),
  featureRow({
    items: [
      {
        title: 'Upfront flat quotes',
        body: 'You get one clear, written price before we lift a box — no hourly meter creeping up, no surprise fees added on at the curb when the truck’s already full.',
      },
      {
        title: 'Careful, insured crews',
        body: 'Every crew is background-checked, uniformed and fully insured. Furniture gets blanket-wrapped, floors get protected, and doorframes go home without a scratch.',
      },
      {
        title: 'Packing & supplies',
        body: 'Boxes, tape, wrap and dish barrels — we can bring it all, or pack the whole place for you. Nothing loaded loose, nothing you have to figure out yourself.',
      },
      {
        title: 'On time, guaranteed',
        body: 'We give you a real arrival window and text when we’re on the way. Moving day runs on your schedule, not ours — and we don’t leave until it’s done right.',
      },
    ],
  }),
  serviceMenu({
    heading: 'What we can help you move',
    intro: 'Every estimate is free. Pick the one that fits and see how long it takes and the next open time — then we come out and give you a flat, written price.',
    surface: 'muted',
    columns: 2,
    items: [
      {
        name: 'Free estimate',
        priceCents: 0,
        durationMin: 30,
        desc: 'A quick, no-obligation walkthrough and a flat written price.',
      },
      {
        name: 'In-home estimate',
        priceCents: 0,
        durationMin: 60,
        desc: 'A full room-by-room look so your quote is exact.',
      },
      {
        name: 'Packing service',
        priceCents: 0,
        durationMin: 45,
        desc: 'We bring the supplies and box it all up for you.',
      },
      {
        name: 'Loading help',
        priceCents: 0,
        durationMin: 30,
        desc: 'Got the truck? Book a crew to load or unload it.',
      },
    ],
    cta: { label: 'See everything & book', href: '/book' },
  }),
  splitFeature({
    image: url(IMG.careful),
    alt: 'A mover carefully blanket-wrapping a dresser before loading it',
    heading: 'We treat your things like they’re ours',
    body: [
      'Anyone can carry a box. What sets Sure Hands apart is what happens to the things you actually care about — the dresser from your grandmother, the TV you just paid for, the corner of the wall on the way out the door.',
      'We wrap furniture in blankets, pad the sharp edges, lay runners on your floors and shrink-wrap the drawers so nothing shifts. Careful isn’t slower with us — it’s just how the job gets done.',
    ],
    cta: { label: 'Get your free estimate', href: '/book' },
  }),
  teamRow({
    heading: 'The crew who’ll be at your door',
    intro: 'Real people, not day-labor strangers — the same friendly faces who show up, wrap it up and get you moved.',
    members: [
      {
        name: 'Jordan Pierce',
        role: 'Lead move coordinator',
        image: url(IMG.jordan),
        alt: 'Jordan Pierce, lead move coordinator',
        bio: 'Jordan plans your move end to end — the crew, the truck, the timing — and answers the phone when you call.',
      },
      {
        name: 'Tasha Owens',
        role: 'Crew lead & furniture pro',
        image: url(IMG.tasha),
        alt: 'Tasha Owens, crew lead and furniture pro',
        bio: 'Tight staircases and heavy antiques are Tasha’s specialty. If it’s awkward and precious, she’s the one you want carrying it.',
      },
      {
        name: 'Luis Ferreira',
        role: 'Packing & loading lead',
        image: url(IMG.luis),
        alt: 'Luis Ferreira, packing and loading lead',
        bio: 'Luis packs a truck like a puzzle so nothing moves in transit — and can box your whole kitchen faster than you’d believe.',
      },
    ],
  }),
  testimonial({
    quote: 'They showed up right on time, wrapped everything, and had our two-bedroom loaded in under two hours. The final price was exactly what they quoted. Not one scratch on a single thing. We’ll never use anyone else.',
    attribution: 'Marcus & Dani R., moved across town',
  }),
  bookingCta({
    title: 'Moving soon? Let’s get you a real price.',
    sub: 'Book a free estimate online in about a minute. Pick a day, and we’ll confirm your window and come take a look — no obligation.',
    cta: { label: 'Get a free estimate', href: '/book' },
  }),
];

const BOOK_INTRO = [
  photoHero({
    image: url(IMG.careful),
    alt: 'A mover carefully blanket-wrapping a dresser before loading it',
    title: 'Book your free estimate',
    sub: 'Choose the kind of move you’re planning to see how long the visit takes and the next open time — then pick your day and we’ll come give you a flat, written price.',
    primary: { label: 'See estimates below', href: '/book' },
    overlay: 'darker',
    align: 'start',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.hero),
    alt: 'Two uniformed movers carrying a wrapped sofa down a front walk to a loaded truck',
    heading: 'About Sure Hands Moving',
    body: [
      'We started Sure Hands because moving shouldn’t be the horror story everyone warns you about — the crew that shows up late, the price that doubles at the end, the coffee table that comes off the truck with a fresh gouge.',
      'We’re a local, family-run moving company serving homes and apartments across the area. Flat quotes, careful insured crews, and movers who genuinely take care of your stuff. Same friendly faces, honest prices, and a job done right the first time.',
    ],
    cta: { label: 'Get a free estimate', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'How a move with us works',
    items: [
      {
        title: 'A flat price first',
        body: 'We look at what you’re moving, talk through the details, and hand you one clear written quote. Nothing starts, and nothing changes, until you say yes to the number.',
      },
      {
        title: 'Wrapped, padded, protected',
        body: 'Furniture gets blankets, floors get runners, walls get corner guards. We move like it’s our own home, because a clean move is the whole point of hiring pros.',
      },
      {
        title: 'Done right, or we make it right',
        body: 'We’re licensed and insured, and we stand behind every move. If something isn’t right, you call us and we fix it — we’re your neighbors, not a call center.',
      },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Where we move & how to reach us',
    address: ['Sure Hands Moving', '318 Maple Yard Road', 'Springfield, IL 62704'],
    mapLocation: '318 Maple Yard Road, Springfield, IL 62704',
    hours: [
      { day: 'Monday – Friday', time: '7:00 – 6:00' },
      { day: 'Saturday', time: '8:00 – 5:00' },
      { day: 'Sunday', time: 'By appointment' },
      { day: 'Estimates', time: 'Always free' },
    ],
  }),
  bookingCta({
    title: 'Rather book than call?',
    sub: 'See the next open times and reserve your free estimate online — no phone tag, no waiting on hold.',
    surface: 'muted',
    cta: { label: 'Get a free estimate', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-moving-local',
  name: 'Moving (Local & Friendly)',
  summary:
    'A friendly local-mover site — a clean off-white palette with a confident green primary and warm amber accent, a sturdy sans display and photo-led care. Installs a working online booking flow: customers book a free estimate or an in-home walkthrough and get a real time slot. Ships a full estimate menu (local, apartment, packing, loading help, furniture), three move coordinators as dispatchable crews with their own hours, and standard + move-date deposit policies. Ships as "Sure Hands Moving".',
  tagline: 'A friendly, reliable template for local movers — book free estimates online from day one.',
  industry: 'Moving',
  sortWeight: 14,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: {
    businessName: 'Sure Hands Moving',
    tagline: 'Movers who show up and take care of your stuff.',
  },
  theme: surehands,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Sure Hands Moving — friendly local movers',
      description:
        'Sure Hands Moving is a local, family-run moving company with flat upfront quotes, careful insured crews and packing help. Book a free estimate online.',
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
