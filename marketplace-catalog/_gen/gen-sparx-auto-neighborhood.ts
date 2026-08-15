// sparx-auto-neighborhood — "Sparrow & Sons Auto", a trusted NEIGHBORHOOD auto shop.
//
// The honest, family-run repair shop of the design research — been-here-30-years
// reliability, "we'll tell you what it actually needs," no upsell. A deep racing-blue
// primary, a warm-red accent, an off-white ground and a sturdy slab-ish sans over Inter,
// with real photography of the shop and the work carrying the page. Deliberately the WARM,
// photo-led sibling to the European-import specialist template (dark, precision, premium):
// same booking spine, a different business and a different feeling. The functional core is
// booking a visit — a service, a diagnostic, or a free estimate — with mechanics AND
// service bays as the bookable resources.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-auto-neighborhood.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-auto-neighborhood/**" \
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
  hero: 'auto-neighborhood-hero',
  bay: 'auto-neighborhood-bay',
  ray: 'auto-neighborhood-ray',
  danny: 'auto-neighborhood-danny',
  miguel: 'auto-neighborhood-miguel',
} as const;

const PHOTO: Record<string, string> = {
  "sparrow-hero": "https://images.unsplash.com/photo-1596986952526-3be237187071?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YXV0byUyMHJlcGFpciUyMHNob3AlMjBtZWNoYW5pY3xlbnwwfDB8fHwxNzg2Mzg5MjUzfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "sparrow-bay": "https://images.unsplash.com/photo-1566249827553-6b5276ff157e?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2FyJTIwb24lMjBsaWZ0JTIwZ2FyYWdlfGVufDB8MHx8fDE3ODYzODkyNTZ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "sparrow-ray": "https://images.unsplash.com/photo-1532601026355-709a58040664?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bWVjaGFuaWMlMjBwb3J0cmFpdCUyMG1hbnxlbnwwfDB8fHwxNzg2Mzg5MjU5fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "sparrow-danny": "https://images.unsplash.com/photo-1759521296144-fe6f2d2dc769?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29ya2VyJTIwcG9ydHJhaXQlMjB1bmlmb3JtfGVufDB8MHx8fDE3ODYzODkyNjJ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "sparrow-miguel": "https://images.unsplash.com/photo-1504222490345-c075b6008014?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YXV0byUyMG1lY2hhbmljJTIwcG9ydHJhaXR8ZW58MHwwfHx8MTc4NjM4OTI2NXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
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
    url: src('sparrow-hero'),
    alt: 'A car up on a lift in a clean, well-lit neighborhood repair shop',
  },
  {
    id: IMG.bay,
    url: src('sparrow-bay'),
    alt: 'Open garage bay doors with the shop team working inside',
  },
  { id: IMG.ray, url: src('sparrow-ray'), alt: 'Ray Sparrow, owner and master technician' },
  { id: IMG.danny, url: src('sparrow-danny'), alt: 'Danny Sparrow, service technician' },
  { id: IMG.miguel, url: src('sparrow-miguel'), alt: 'Miguel Reyes, brake and suspension tech' },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-auto-neighborhood: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "sparrow": off-white ground, racing-blue primary, warm-red accent, slab sans ─
const sparrow = defineTheme({
  name: 'sparrow',
  type: { body: face('Inter', 'sans-serif'), head: face('Archivo', 'sans-serif') },
  shape: { selector: '0.25rem', field: '0.25rem', box: '0.375rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(97% 0.005 250)', // off-white
      'oklch(93% 0.008 250)', // pale slate
      'oklch(88% 0.011 250)', // hairline
      'oklch(24% 0.02 255)', // dark slate ink
    ],
    roles: {
      primary: 'oklch(42% 0.11 255)', // deep racing blue / navy
      secondary: 'oklch(37% 0.02 255)', // dark slate (readable micro-labels on light)
      accent: 'oklch(56% 0.18 32)', // warm red
      neutral: 'oklch(28% 0.015 255)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(24% 0.02 255)',
      'oklch(20% 0.018 255)',
      'oklch(16% 0.015 255)',
      'oklch(94% 0.006 250)',
    ],
    roles: {
      primary: 'oklch(70% 0.12 250)',
      secondary: 'oklch(74% 0.02 250)',
      accent: 'oklch(66% 0.17 33)',
      neutral: 'oklch(82% 0.015 250)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the booking spine (policies, mechanics + bays + hours, the visit menu) ──
const hours = (days: number[], startMinute: number, endMinute: number) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

const SCHEDULING = {
  policies: [
    {
      handle: 'shop-standard',
      name: 'Standard visit',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [1440, 120],
      policyText:
        'Give us a day’s notice to move or cancel and there’s no charge. We’ll text a reminder the day before and two hours ahead so nothing sneaks up on you.',
    },
    {
      handle: 'drop-off',
      name: 'Drop-off job',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [2880, 1440, 120],
      policyText:
        'For bigger jobs, drop the car and keys the evening before or first thing that morning. We’ll call with a plain-English estimate before we touch a thing, and you approve the work.',
    },
  ],
  resources: [
    {
      handle: 'ray',
      name: 'Ray Sparrow',
      kind: 'staff',
      skillTags: ['diagnostics', 'engine', 'brakes', 'general'],
      windows: hours([1, 2, 3, 4, 5], 480, 1080), // Mon–Fri 8–6
    },
    {
      handle: 'danny',
      name: 'Danny Sparrow',
      kind: 'staff',
      skillTags: ['oil', 'tires', 'inspection', 'general'],
      windows: hours([1, 2, 3, 4, 5, 6], 480, 1020), // Mon–Sat 8–5
    },
    {
      handle: 'miguel',
      name: 'Miguel Reyes',
      kind: 'staff',
      skillTags: ['brakes', 'suspension', 'general'],
      windows: hours([2, 3, 4, 5, 6], 540, 1080), // Tue–Sat 9–6
    },
    {
      handle: 'bay-1',
      name: 'Service bay 1',
      kind: 'space',
      skillTags: ['bay'],
      windows: hours([1, 2, 3, 4, 5, 6], 480, 1080), // Mon–Sat 8–6
    },
    {
      handle: 'bay-2',
      name: 'Service bay 2',
      kind: 'space',
      skillTags: ['bay'],
      windows: hours([1, 2, 3, 4, 5], 480, 1080), // Mon–Fri 8–6
    },
  ],
  services: [
    {
      handle: 'free-estimate',
      name: 'Free estimate',
      description:
        'Not sure what’s wrong? Bring it by. We’ll look it over and tell you honestly what it needs — no charge, no pressure.',
      durationMinutes: 30,
      priceCents: 0,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'mechanic', kind: 'staff', skillTags: ['general'], count: 1 },
        { role: 'bay', kind: 'space', skillTags: ['bay'], count: 1 },
      ],
      policyHandle: 'shop-standard',
    },
    {
      handle: 'oil-change',
      name: 'Oil & filter change',
      description: 'Full-synthetic oil, a new filter and a quick once-over of belts, fluids and tires.',
      durationMinutes: 30,
      priceCents: 4500,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'mechanic', kind: 'staff', skillTags: ['oil'], count: 1 },
        { role: 'bay', kind: 'space', skillTags: ['bay'], count: 1 },
      ],
      policyHandle: 'shop-standard',
    },
    {
      handle: 'diagnostic',
      name: 'Diagnostic inspection',
      description: 'A strange noise, a pull, a shudder? We track down what’s actually causing it before you spend a dime on parts.',
      durationMinutes: 60,
      priceCents: 9000,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'mechanic', kind: 'staff', skillTags: ['diagnostics'], count: 1 },
        { role: 'bay', kind: 'space', skillTags: ['bay'], count: 1 },
      ],
      policyHandle: 'shop-standard',
    },
    {
      handle: 'brake-service',
      name: 'Brake service',
      description: 'Pads, rotors and a full brake inspection — so you stop the way you’re supposed to. Every job is warrantied.',
      durationMinutes: 120,
      priceCents: 28000,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'mechanic', kind: 'staff', skillTags: ['brakes'], count: 1 },
        { role: 'bay', kind: 'space', skillTags: ['bay'], count: 1 },
      ],
      policyHandle: 'drop-off',
    },
    {
      handle: 'tire-rotation',
      name: 'Tire rotation & balance',
      description: 'Rotate, balance and set your pressures right — the cheapest way to make a set of tires last longer.',
      durationMinutes: 30,
      priceCents: 3500,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'mechanic', kind: 'staff', skillTags: ['tires'], count: 1 },
        { role: 'bay', kind: 'space', skillTags: ['bay'], count: 1 },
      ],
      policyHandle: 'shop-standard',
    },
    {
      handle: 'safety-inspection',
      name: 'Safety inspection',
      description: 'The state check, done right the first time — plus an honest heads-up on anything that’ll need attention soon.',
      durationMinutes: 45,
      priceCents: 3000,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'mechanic', kind: 'staff', skillTags: ['inspection'], count: 1 },
        { role: 'bay', kind: 'space', skillTags: ['bay'], count: 1 },
      ],
      policyHandle: 'shop-standard',
    },
    {
      handle: 'check-engine',
      name: 'Check-engine light',
      description: 'That light means something — we pull the codes, explain them in plain English and only fix what’s actually broken.',
      durationMinutes: 60,
      priceCents: 12000,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'mechanic', kind: 'staff', skillTags: ['diagnostics'], count: 1 },
        { role: 'bay', kind: 'space', skillTags: ['bay'], count: 1 },
      ],
      policyHandle: 'drop-off',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  photoHero({
    image: url(IMG.hero),
    alt: 'A car up on a lift in a clean, well-lit neighborhood repair shop',
    title: 'The honest shop your neighbors already use',
    sub: 'Family-run since 1994. We fix what needs fixing, tell you what doesn’t, and stand behind every job. Book a visit in about a minute.',
    primary: { label: 'Book a service', href: '/book' },
    secondary: { label: 'Get a free estimate', href: '/book' },
    overlay: 'dark',
  }),
  featureRow({
    items: [
      {
        title: 'Honest estimates, up front',
        body: 'We call with a plain-English quote before we start, and you approve the work. No surprise line items when you pick up the car.',
      },
      {
        title: 'ASE-certified technicians',
        body: 'The people under your hood are trained and certified — not a rotating crew of whoever’s cheapest this week.',
      },
      {
        title: 'Warranty on every job',
        body: 'Parts and labor are covered for 24 months / 24,000 miles. If something we fixed isn’t right, we make it right.',
      },
      {
        title: 'We explain it in plain English',
        body: 'No jargon, no scare tactics. We’ll show you what’s worn, what can wait, and what actually matters for safety.',
      },
    ],
  }),
  serviceMenu({
    heading: 'What we do',
    intro: 'The everyday work that keeps a car running well. Book any of these online — live times and prices are on the booking page.',
    surface: 'muted',
    columns: 2,
    items: [
      { name: 'Free estimate', priceCents: 0, durationMin: 30, desc: 'We look it over and tell you what it needs — no charge.' },
      { name: 'Oil & filter change', priceCents: 4500, durationMin: 30, desc: 'Full-synthetic oil, new filter, quick safety once-over.' },
      { name: 'Brake service', priceCents: 28000, durationMin: 120, desc: 'Pads, rotors and a full inspection — warrantied.' },
      { name: 'Check-engine light', priceCents: 12000, durationMin: 60, desc: 'We pull the codes and explain what they mean.' },
      { name: 'Diagnostic inspection', priceCents: 9000, durationMin: 60, desc: 'Track down the real cause before you buy parts.' },
      { name: 'Safety inspection', priceCents: 3000, durationMin: 45, desc: 'The state check, done right the first time.' },
    ],
    cta: { label: 'See everything & book', href: '/book' },
  }),
  splitFeature({
    image: url(IMG.bay),
    alt: 'Open garage bay doors with the shop team working inside',
    heading: 'Thirty years on the same corner',
    body: [
      'Ray Sparrow opened these bay doors in 1994, and his boy Danny grew up sweeping the floors before he started turning wrenches himself. Most of our customers have been coming for a decade or more — and they send their kids.',
      'We’re not the biggest shop in town, and we don’t try to be. We just do good work for a fair price and tell you the truth, so you never have to wonder whether you really needed it.',
    ],
    cta: { label: 'Book your visit', href: '/book' },
  }),
  teamRow({
    heading: 'The people working on your car',
    intro: 'Real names, real faces. Book with whoever you like — they all trained in this shop.',
    members: [
      {
        name: 'Ray Sparrow',
        role: 'Owner · Master technician',
        image: url(IMG.ray),
        alt: 'Ray Sparrow, owner and master technician',
        bio: 'Started the shop in 1994. Engines, diagnostics, and the one who’ll tell you straight if a repair isn’t worth it.',
      },
      {
        name: 'Danny Sparrow',
        role: 'Service technician',
        image: url(IMG.danny),
        alt: 'Danny Sparrow, service technician',
        bio: 'Grew up in the shop. Oil, tires, inspections and keeping your maintenance on track before things break.',
      },
      {
        name: 'Miguel Reyes',
        role: 'Brake & suspension tech',
        image: url(IMG.miguel),
        alt: 'Miguel Reyes, brake and suspension tech',
        bio: 'Fifteen years on brakes, steering and suspension. If it clunks, pulls or squeals, Miguel finds it.',
      },
    ],
  }),
  testimonial({
    quote:
      'Another shop quoted me $1,800 for “everything.” Ray looked at it, fixed the one thing that was actually wrong for $240, and told me the rest could wait. That’s why I’ll never go anywhere else.',
    attribution: 'Dana W., customer since 2016',
  }),
  bookingCta({
    title: 'Need something looked at?',
    sub: 'Pick a service or grab a free estimate, choose a time that works, and we’ll have a bay ready. It takes about a minute.',
    cta: { label: 'Book a service', href: '/book' },
  }),
];

const BOOK_INTRO = [
  photoHero({
    image: url(IMG.bay),
    alt: 'Open garage bay doors with the shop team working inside',
    title: 'Book a visit',
    sub: 'Choose what you need — a service, a diagnostic, or a free estimate — to see live availability, then pick your time and tech.',
    primary: { label: 'See services below', href: '/book' },
    overlay: 'darker',
    align: 'start',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.hero),
    alt: 'A car up on a lift in a clean, well-lit neighborhood repair shop',
    heading: 'About Sparrow & Sons Auto',
    body: [
      'We’re a family shop, plain and simple. Ray started it in 1994 with two bays and a promise: treat every car like it belongs to a neighbor, because most of the time it does.',
      'That promise still runs the place. We don’t sell you work you don’t need, we don’t hide behind jargon, and we don’t hand your car to someone who’s learning on the job. You get certified techs, honest estimates, and a warranty that means what it says.',
    ],
    cta: { label: 'Book a visit', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'How we work',
    items: [
      {
        title: 'We look before we quote',
        body: 'Every job starts with an actual inspection. You get a plain-English estimate and approve the work before we start.',
      },
      {
        title: 'Only what it needs',
        body: 'If something can wait, we’ll tell you. If it’s a safety issue, we’ll tell you that too. Either way, it’s your call.',
      },
      {
        title: 'Backed for 24 months',
        body: 'Parts and labor are covered for 24 months or 24,000 miles. Come back if it’s not right and we’ll take care of it.',
      },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Find the shop',
    address: ['Sparrow & Sons Auto', '412 Ridgeline Avenue', 'Cedar Falls, IA 50613'],
    mapLocation: '412 Ridgeline Avenue, Cedar Falls, IA 50613',
    hours: [
      { day: 'Monday – Friday', time: '8:00 – 6:00' },
      { day: 'Saturday', time: '8:00 – 2:00' },
      { day: 'Sunday', time: 'Closed' },
    ],
  }),
  bookingCta({
    title: 'Rather book than call?',
    sub: 'Grab a time online and we’ll have a bay ready when you pull in — no phone tag, no waiting on hold.',
    surface: 'muted',
    cta: { label: 'Book a service', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-auto-neighborhood',
  name: 'Auto Repair (Neighborhood)',
  summary:
    'A warm, honest template for a family-run neighborhood auto shop — a racing-blue palette with a warm-red accent and real shop photography. Installs online booking from day one: a menu of visits (free estimate, oil, brakes, diagnostics, inspections) with three mechanics AND two service bays as bookable resources, plus a drop-off policy. Ships as "Sparrow & Sons Auto", the shop that tells you what it actually needs.',
  tagline: 'A trusted-neighborhood template for auto shops — book a visit from day one.',
  industry: 'Auto repair',
  sortWeight: 72,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'Sparrow & Sons Auto', tagline: 'We’ll tell you what it actually needs.' },
  theme: sparrow,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Sparrow & Sons Auto — honest neighborhood car repair',
      description:
        'A family-run repair shop since 1994. Honest estimates, ASE-certified techs, and a warranty on every job. Book a service or a free estimate online.',
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
