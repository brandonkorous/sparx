// sparx-plumbing-trusted — "Copper & Main Plumbing", a TRUSTED local plumbing company.
//
// The warm, established, been-here-for-years plumber of the trades research (the Jobber /
// Housecall Pro lane): a deep navy ground with a warm brass accent, sturdy sans display,
// and real photography of people and vans carrying the page. Licensed, upfront flat-rate
// pricing, on-time-or-we-call reliability. The functional core is BOOKING A VISIT —
// homeowners book a free estimate or a service call online and get a time slot, exactly
// how a modern trade runs its schedule. Deliberately the WARM, photo-led, navy-and-brass
// sibling of the separate modern/on-demand plumbing template — same booking spine, a
// different personality.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @wizeworks/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-plumbing-trusted.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-plumbing-trusted/**" \
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
  hero: 'plumbing-trusted-hero',
  story: 'plumbing-trusted-story',
  marcus: 'plumbing-trusted-marcus',
  diego: 'plumbing-trusted-diego',
  sam: 'plumbing-trusted-sam',
} as const;

const PHOTO: Record<string, string> = {
  "coppermain-hero": "https://images.unsplash.com/photo-1676210134188-4c05dd172f89?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGx1bWJlciUyMHdvcmtpbmclMjBwaXBlc3xlbnwwfDB8fHwxNzg2Mzg4MjEzfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "coppermain-story": "https://images.unsplash.com/photo-1530124566582-a618bc2615dc?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGx1bWJpbmclMjB0b29scyUyMHdvcmt8ZW58MHwwfHx8MTc4NjM4ODIxNnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "coppermain-diego": "https://images.unsplash.com/photo-1758599543242-31567fb8766e?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cHJvZmVzc2lvbmFsJTIwbWFuJTIwcG9ydHJhaXQlMjB3b3JrZXJ8ZW58MHwwfHx8MTc4NjM4ODIyMXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "coppermain-sam": "https://images.unsplash.com/photo-1759521296144-fe6f2d2dc769?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29ya2VyJTIwcG9ydHJhaXQlMjB1bmlmb3JtfGVufDB8MHx8fDE3ODYzODgyMjR8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "coppermain-marcus": "https://images.unsplash.com/photo-1757744705465-ea08b0ddc38a?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bWFuJTIwcG9ydHJhaXQlMjBoZWFkc2hvdCUyMHNtaWxpbmd8ZW58MHwwfHx8MTc4NjM4ODM0NXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
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
    url: src('coppermain-hero'),
    alt: 'A uniformed plumber stepping down from a company van with a tool bag',
  },
  {
    id: IMG.story,
    url: src('coppermain-story'),
    alt: 'A plumber fitting a new copper line under a kitchen sink',
  },
  { id: IMG.marcus, url: src('coppermain-marcus'), alt: 'Marcus Bell, master plumber and owner' },
  { id: IMG.diego, url: src('coppermain-diego'), alt: 'Diego Ramos, service and install plumber' },
  { id: IMG.sam, url: src('coppermain-sam'), alt: 'Sam Whitfield, emergency and gas technician' },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-plumbing-trusted: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "coppermain": navy ground, brass accent, off-white light, dark slate ink ──
const coppermain = defineTheme({
  name: 'coppermain',
  type: { body: face('Inter', 'sans-serif'), head: face('Archivo', 'sans-serif') },
  shape: { selector: '0.25rem', field: '0.25rem', box: '0.375rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(98% 0.005 240)', // off-white ground
      'oklch(94% 0.008 240)', // cool paper
      'oklch(89% 0.012 245)', // hairline
      'oklch(25% 0.03 250)', // deep navy ink
    ],
    roles: {
      primary: 'oklch(42% 0.085 250)', // deep steel-navy
      secondary: 'oklch(37% 0.02 250)', // dark slate (readable micro-labels on light)
      accent: 'oklch(70% 0.115 76)', // warm brass
      neutral: 'oklch(30% 0.02 250)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(22% 0.02 250)',
      'oklch(18% 0.018 250)',
      'oklch(14% 0.015 250)',
      'oklch(95% 0.006 240)',
    ],
    roles: {
      primary: 'oklch(70% 0.1 250)', // lifted steel-blue
      secondary: 'oklch(76% 0.02 250)',
      accent: 'oklch(78% 0.12 78)',
      neutral: 'oklch(80% 0.02 250)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the booking spine (policies, plumbers + hours, the visit menu) ────────
const hours = (days: number[], startMinute: number, endMinute: number) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

const SCHEDULING = {
  policies: [
    {
      handle: 'plumbing-standard',
      name: 'Standard visit',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [1440, 120],
      policyText:
        'Give us at least 24 hours’ notice to move or cancel a visit. We text a reminder the day before and confirm when the plumber is on the way.',
    },
    {
      handle: 'emergency-priority',
      name: 'Emergency priority',
      depositType: 'none',
      cancellationWindowHours: 2,
      reminderOffsetsMin: [120],
      policyText:
        'Emergency calls are dispatched to the first available plumber, often same-day. We confirm the arrival window by text so you’re never left waiting.',
    },
  ],
  resources: [
    {
      handle: 'marcus',
      name: 'Marcus Bell',
      kind: 'staff',
      skillTags: ['repair', 'drain', 'water-heater'],
      windows: hours([1, 2, 3, 4, 5], 420, 1020), // Mon–Fri 7–5
    },
    {
      handle: 'diego',
      name: 'Diego Ramos',
      kind: 'staff',
      skillTags: ['repair', 'install', 'remodel'],
      windows: hours([1, 2, 3, 4, 5, 6], 480, 1020), // Mon–Sat 8–5
    },
    {
      handle: 'sam',
      name: 'Sam Whitfield',
      kind: 'staff',
      skillTags: ['emergency', 'repair', 'gas'],
      windows: hours([2, 3, 4, 5, 6], 480, 1080), // Tue–Sat 8–6
    },
  ],
  services: [
    {
      handle: 'free-estimate',
      name: 'Free estimate',
      description:
        'We come out, look at the job and give you a flat, written price before any work starts — no charge, no pressure.',
      durationMinutes: 30,
      priceCents: 0,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'plumber', kind: 'staff', skillTags: ['repair'], count: 1 },
      ],
      policyHandle: 'plumbing-standard',
    },
    {
      handle: 'diagnostic-visit',
      name: 'Diagnostic service call',
      description:
        'A flat call-out fee to find the problem. If you go ahead with the repair the same day, this comes right off the total.',
      durationMinutes: 60,
      priceCents: 8900,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'plumber', kind: 'staff', skillTags: ['repair'], count: 1 },
      ],
      policyHandle: 'plumbing-standard',
    },
    {
      handle: 'drain-cleaning',
      name: 'Drain cleaning',
      description:
        'A slow or backed-up drain cleared and tested — kitchen, bath, laundry or main line.',
      durationMinutes: 90,
      priceCents: 14900,
      bufferAfterMin: 15,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'plumber', kind: 'staff', skillTags: ['drain'], count: 1 },
      ],
      policyHandle: 'plumbing-standard',
    },
    {
      handle: 'leak-repair',
      name: 'Leak repair',
      description:
        'A dripping pipe, fitting or valve tracked down and fixed right the first time, with the area left clean.',
      durationMinutes: 60,
      priceCents: 17900,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'plumber', kind: 'staff', skillTags: ['repair'], count: 1 },
      ],
      policyHandle: 'plumbing-standard',
    },
    {
      handle: 'water-heater-service',
      name: 'Water heater service',
      description:
        'Flush, inspect and repair a tank or tankless heater — or a straight quote to replace one that’s had its day.',
      durationMinutes: 90,
      priceCents: 21900,
      bufferAfterMin: 15,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'plumber', kind: 'staff', skillTags: ['water-heater'], count: 1 },
      ],
      policyHandle: 'plumbing-standard',
    },
    {
      handle: 'fixture-install',
      name: 'Fixture install',
      description:
        'A new faucet, toilet, sink, garbage disposal or shower valve supplied and fitted, tested before we leave.',
      durationMinutes: 120,
      priceCents: 19900,
      bufferAfterMin: 15,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'plumber', kind: 'staff', skillTags: ['install'], count: 1 },
      ],
      policyHandle: 'plumbing-standard',
    },
    {
      handle: 'emergency-callout',
      name: 'Emergency call-out',
      description:
        'A burst pipe, no water or a backed-up main — we dispatch the first available plumber and confirm your arrival window by text.',
      durationMinutes: 120,
      priceCents: 24900,
      requiresApproval: true,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'plumber', kind: 'staff', skillTags: ['emergency'], count: 1 },
      ],
      policyHandle: 'emergency-priority',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  photoHero({
    image: url(IMG.hero),
    alt: 'A uniformed plumber stepping down from a company van with a tool bag',
    title: 'The plumber your neighbors already trust',
    sub: 'Licensed, upfront pricing and on-time every time. Book a free estimate online and we’ll give you a flat, written price before any work starts.',
    primary: { label: 'Book a free estimate', href: '/book' },
    secondary: { label: 'See our services', href: '/book' },
    overlay: 'dark',
  }),
  featureRow({
    items: [
      {
        title: 'Licensed & insured',
        body: 'Fully licensed, bonded and insured — the same crew in the same vans, background-checked and in uniform at your door.',
      },
      {
        title: 'Upfront flat-rate pricing',
        body: 'You approve a written price before we pick up a wrench. No hourly meter running, no surprise line items at the end.',
      },
      {
        title: 'On time, or we call',
        body: 'We give you a real arrival window and text when we’re on the way. Running behind? You hear from us first, not after.',
      },
      {
        title: 'Workmanship guarantee',
        body: 'Every repair and install is backed by our written guarantee. If something isn’t right, we come back and make it right.',
      },
    ],
  }),
  serviceMenu({
    heading: 'What we come out for',
    intro: 'The visits we book most. Pick one to see the flat price, how long it takes and the next open time.',
    surface: 'muted',
    columns: 2,
    items: [
      {
        name: 'Free estimate',
        priceCents: 0,
        durationMin: 30,
        desc: 'A written, no-charge price before any work begins.',
      },
      {
        name: 'Leak repair',
        priceCents: 17900,
        durationMin: 60,
        desc: 'A dripping pipe or valve found and fixed for good.',
      },
      {
        name: 'Drain cleaning',
        priceCents: 14900,
        durationMin: 90,
        desc: 'A slow or backed-up drain cleared and tested.',
      },
      {
        name: 'Water heater service',
        priceCents: 21900,
        durationMin: 90,
        desc: 'Flush, repair or a straight quote to replace.',
      },
    ],
    cta: { label: 'See everything & book', href: '/book' },
  }),
  splitFeature({
    image: url(IMG.story),
    alt: 'A plumber fitting a new copper line under a kitchen sink',
    heading: 'Family-run since 2004',
    body: [
      'Copper & Main started as one plumber, one van and a simple promise: show up when we say, charge what we quote, and treat your home like it’s our own.',
      'Twenty years later we’re still family-run — a small crew of licensed plumbers who’d rather do the job right and be your plumber for life than chase the next ticket.',
    ],
    cta: { label: 'Book your visit', href: '/book' },
  }),
  teamRow({
    heading: 'The crew who’ll be at your door',
    intro: 'The same familiar faces every visit — licensed, background-checked and glad to explain what they’re doing.',
    members: [
      {
        name: 'Marcus Bell',
        role: 'Master plumber & owner',
        image: url(IMG.marcus),
        alt: 'Marcus Bell, master plumber and owner',
        bio: 'Twenty years on the tools. Marcus handles repairs, drains and water heaters — and answers the phone.',
      },
      {
        name: 'Diego Ramos',
        role: 'Service & install plumber',
        image: url(IMG.diego),
        alt: 'Diego Ramos, service and install plumber',
        bio: 'Fixtures, repipes and remodels. Diego is the one who leaves the job cleaner than he found it.',
      },
      {
        name: 'Sam Whitfield',
        role: 'Emergency & gas technician',
        image: url(IMG.sam),
        alt: 'Sam Whitfield, emergency and gas technician',
        bio: 'Burst pipes and gas lines don’t wait. Sam takes the emergency calls and gets there fast.',
      },
    ],
  }),
  testimonial({
    quote: 'Water was coming through the ceiling at 9pm. Sam had it shut off and fixed within the hour and charged exactly what he quoted. These are our plumbers now, full stop.',
    attribution: 'Karen M., Riverside homeowner',
  }),
  bookingCta({
    title: 'Got a plumbing problem? Let’s take a look.',
    sub: 'Book a free estimate or a service call online in about a minute. Pick a day, and we’ll confirm your window.',
    cta: { label: 'Book your visit', href: '/book' },
  }),
];

const BOOK_INTRO = [
  photoHero({
    image: url(IMG.story),
    alt: 'A plumber fitting a new copper line under a kitchen sink',
    title: 'Book a plumber',
    sub: 'Choose the visit you need to see the flat price, how long it takes and the next open time — then pick your plumber and day.',
    primary: { label: 'See services below', href: '/book' },
    overlay: 'darker',
    align: 'start',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.hero),
    alt: 'A uniformed plumber stepping down from a company van with a tool bag',
    heading: 'About Copper & Main',
    body: [
      'We built Copper & Main Plumbing on the plumbing most people wish they got — someone who shows up when they say, quotes an honest flat price, and does the work like it’s their own home.',
      'We’re a small, family-run crew of licensed plumbers serving homeowners across the area. No call-center runaround, no upsells, no hourly meter. Just the same trusted faces, fair prices and work that’s guaranteed.',
    ],
    cta: { label: 'Book a visit', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'How we work',
    items: [
      {
        title: 'A written price first',
        body: 'We diagnose the problem, explain your options in plain language, and hand you a flat written price. Nothing starts until you say yes.',
      },
      {
        title: 'Clean, respectful work',
        body: 'Shoe covers, drop cloths and a tidy site. We treat your home the way we’d want ours treated, and we haul away the old parts.',
      },
      {
        title: 'Guaranteed and here to stay',
        body: 'Every job is backed in writing, and we’re a call away if anything needs a second look. We’re not going anywhere.',
      },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Where we work & how to reach us',
    address: ['Copper & Main Plumbing', '412 Foundry Road', 'Riverside, CA 92507'],
    mapLocation: '412 Foundry Road, Riverside, CA 92507',
    hours: [
      { day: 'Monday – Friday', time: '7:00 – 5:00' },
      { day: 'Saturday', time: '8:00 – 6:00' },
      { day: 'Sunday', time: 'Emergencies only' },
      { day: 'Emergency line', time: '24 / 7' },
    ],
  }),
  bookingCta({
    title: 'Rather book than call?',
    sub: 'See the next open times and reserve your visit online — no phone tag, no waiting on hold.',
    surface: 'muted',
    cta: { label: 'Book your visit', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-plumbing-trusted',
  name: 'Plumbing (Trusted Local)',
  summary:
    'A warm, trusted local-plumber site — a deep navy palette with a brass accent, sturdy sans display and photo-led reliability. Installs a working online booking flow: homeowners book a free estimate or a service call and get a real time slot. Ships a full visit menu (estimate, drain, leak, water-heater, fixture install, emergency), three plumbers as dispatchable staff with their own hours, and standard + emergency policies. Ships as "Copper & Main Plumbing".',
  tagline: 'A warm, trusted template for local plumbers — book visits online from day one.',
  industry: 'Plumbing',
  sortWeight: 78,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'Copper & Main Plumbing', tagline: 'Show up on time. Quote it straight. Fix it right.' },
  theme: coppermain,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Copper & Main Plumbing — trusted local plumbers',
      description:
        'Copper & Main is a family-run, licensed plumbing company with upfront flat-rate pricing and on-time service. Book a free estimate or a service call online.',
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
