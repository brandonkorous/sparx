// sparx-pool-repair — "AquaTech Pool & Spa", a technical POOL & SPA REPAIR specialist.
//
// The expert, precise side of pool ownership: pump and heater repair, leak detection,
// equipment and automation upgrades, resurfacing and renovation. "We fix what others
// can't." A deep navy-teal palette on a crisp near-white ground, a bright cyan signal
// accent, a sharp technical sans display, and a TYPE-FIRST hero that leads with the
// promise of a fixed pool over a stock lifestyle photo. Deliberately the OPPOSITE of the
// friendly weekly-maintenance pool template (bright, recurring, warm) — same booking
// spine, a colder, more technical business built around dispatching a service call.
//
// The functional core is BOOKING A SERVICE CALL: a diagnostic visit, a free repair
// estimate, or a specialist consult, each routed to a technician by skill. This file is
// JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-pool-repair.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-pool-repair/**" \
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
  typeHero,
  type ServiceSiteSpec,
} from './service-sites/harness';

// ── Imagery (swap-ready; each id also names an entry in ASSETS) ────────────────────
const IMG = {
  equipment: 'pool-repair-equipment',
  diagnostics: 'pool-repair-diagnostics',
  spa: 'pool-repair-spa',
  ray: 'pool-repair-ray',
  priya: 'pool-repair-priya',
  devin: 'pool-repair-devin',
} as const;

const PHOTO: Record<string, string> = {
  "aquatech-equipment": "https://images.unsplash.com/photo-1621245700087-a8617f91cdbe?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cG9vbCUyMHB1bXAlMjBlcXVpcG1lbnR8ZW58MHwwfHx8MTc4NjM5NDIyMnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "aquatech-diagnostics": "https://images.unsplash.com/photo-1722325009084-6bfc230f0860?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cG9vbCUyMHRlY2huaWNpYW4lMjB3b3JraW5nfGVufDB8MHx8fDE3ODYzOTQyMjV8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "aquatech-spa": "https://images.unsplash.com/photo-1781455495098-3643ccc923a0?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8aG90JTIwdHViJTIwc3BhfGVufDB8MHx8fDE3ODYzOTQyMjl8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "aquatech-ray": "https://images.unsplash.com/photo-1764014353079-08ece464a226?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dGVjaG5pY2lhbiUyMHBvcnRyYWl0JTIwbWFufGVufDB8MHx8fDE3ODYzODgyNDl8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "aquatech-priya": "https://images.unsplash.com/photo-1581091224003-01e7c2e69f6f?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjB0ZWNobmljaWFuJTIwcG9ydHJhaXR8ZW58MHwwfHx8MTc4NjM5NDIzM3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "aquatech-devin": "https://images.unsplash.com/photo-1759521296144-fe6f2d2dc769?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29ya2VyJTIwcG9ydHJhaXQlMjB1bmlmb3JtfGVufDB8MHx8fDE3ODYzODkyNjJ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
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
    id: IMG.equipment,
    url: src('aquatech-equipment'),
    alt: 'A pool equipment pad with a variable-speed pump, heater and automation panel',
  },
  {
    id: IMG.diagnostics,
    url: src('aquatech-diagnostics'),
    alt: 'A technician pressure-testing pool plumbing to trace a hidden leak',
  },
  {
    id: IMG.spa,
    url: src('aquatech-spa'),
    alt: 'A freshly resurfaced spa with clear water and new tile at dusk',
  },
  { id: IMG.ray, url: src('aquatech-ray'), alt: 'Ray Alvarez, repair and pump lead' },
  { id: IMG.priya, url: src('aquatech-priya'), alt: 'Priya Nair, leak and heater specialist' },
  { id: IMG.devin, url: src('aquatech-devin'), alt: 'Devin Cole, renovation and automation lead' },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-pool-repair: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "aquatech": crisp near-white ground, deep navy-teal primary, dark slate steel
// secondary, a bright cyan signal accent, a sharp technical sans display ────────────────────
const aquatech = defineTheme({
  name: 'aquatech',
  type: { body: face('Inter', 'sans-serif'), head: face('Space Grotesk', 'sans-serif') },
  shape: { selector: '0.1875rem', field: '0.1875rem', box: '0.3125rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(98% 0.004 220)', // crisp near-white
      'oklch(94% 0.008 220)', // cool mist
      'oklch(89% 0.011 225)', // hairline
      'oklch(22% 0.03 240)', // deep slate ink
    ],
    roles: {
      primary: 'oklch(44% 0.10 235)', // deep navy-teal
      secondary: 'oklch(35% 0.025 245)', // dark slate steel (readable micro-labels on light)
      accent: 'oklch(72% 0.15 200)', // bright cyan signal
      neutral: 'oklch(28% 0.018 240)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(20% 0.028 240)',
      'oklch(16% 0.022 240)',
      'oklch(13% 0.016 240)',
      'oklch(95% 0.005 220)',
    ],
    roles: {
      primary: 'oklch(64% 0.12 225)', // lifted navy-teal
      secondary: 'oklch(74% 0.02 230)', // light steel
      accent: 'oklch(78% 0.15 200)',
      neutral: 'oklch(82% 0.016 230)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the booking spine (policies, technicians + hours, the service menu) ────
const hours = (days: number[], startMinute: number, endMinute: number) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

const SCHEDULING = {
  policies: [
    {
      handle: 'service-standard',
      name: 'Standard service call',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [1440, 120],
      policyText:
        'Give us at least 24 hours’ notice to change or cancel a service call. We text a reminder the day before and two hours ahead, with your technician’s name and arrival window.',
    },
    {
      handle: 'project-consult',
      name: 'Project consult',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [2880, 1440, 120],
      policyText:
        'Estimates and upgrade consults are booked ahead and reminded twice, so we arrive with the right people and a plan. Reschedule any time with a day’s notice.',
    },
  ],
  resources: [
    {
      handle: 'ray',
      name: 'Ray Alvarez',
      kind: 'staff',
      skillTags: ['repair', 'pumps', 'general'],
      windows: hours([1, 2, 3, 4, 5], 420, 960), // Mon–Fri 7–4
    },
    {
      handle: 'priya',
      name: 'Priya Nair',
      kind: 'staff',
      skillTags: ['leak', 'heater', 'general'],
      windows: hours([1, 2, 3, 4, 5, 6], 480, 1020), // Mon–Sat 8–5
    },
    {
      handle: 'devin',
      name: 'Devin Cole',
      kind: 'staff',
      skillTags: ['renovation', 'automation', 'general'],
      windows: hours([2, 3, 4, 5, 6], 420, 960), // Tue–Sat 7–4
    },
  ],
  services: [
    {
      handle: 'service-call-diagnostic',
      name: 'Service call & diagnostic',
      description:
        'A technician comes out, traces the fault and explains exactly what’s wrong in plain terms — then gives you a fixed price to fix it before any work starts. The flat call fee comes off the repair if you go ahead.',
      durationMinutes: 60,
      priceCents: 8900,
      bufferAfterMin: 15,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'technician', kind: 'staff', skillTags: ['general'], count: 1 },
      ],
      policyHandle: 'service-standard',
    },
    {
      handle: 'free-repair-estimate',
      name: 'Free repair estimate',
      description:
        'Know what’s broken and just want a number? We assess the equipment or the problem and give you a written, no-pressure quote for the repair — parts and labor spelled out. Always free.',
      durationMinutes: 45,
      priceCents: 0,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'technician', kind: 'staff', skillTags: ['general'], count: 1 },
      ],
      policyHandle: 'project-consult',
    },
    {
      handle: 'pump-motor-repair',
      name: 'Pump & motor repair',
      description:
        'A noisy, leaking or dead pump diagnosed and repaired — seals, bearings, motors and variable-speed drives across every major brand. We carry the common parts, so most jobs are done in a single visit.',
      durationMinutes: 90,
      priceCents: 14900,
      bufferAfterMin: 15,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'technician', kind: 'staff', skillTags: ['general'], count: 1 },
      ],
      policyHandle: 'service-standard',
    },
    {
      handle: 'heater-repair',
      name: 'Heater & heat-pump repair',
      description:
        'Gas heaters and heat pumps that won’t fire, short-cycle or throw error codes — traced to the real cause and repaired, not just reset. A specialist who reads the board instead of guessing at parts.',
      durationMinutes: 90,
      priceCents: 15900,
      bufferAfterMin: 15,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'technician', kind: 'staff', skillTags: ['heater'], count: 1 },
      ],
      policyHandle: 'service-standard',
    },
    {
      handle: 'leak-detection',
      name: 'Leak detection',
      description:
        'Losing water and can’t find where? We pressure-test the plumbing, dye-test the shell and fittings, and pinpoint the leak without tearing up your deck — then show you exactly what it takes to seal it.',
      durationMinutes: 120,
      priceCents: 19900,
      bufferAfterMin: 15,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'technician', kind: 'staff', skillTags: ['leak'], count: 1 },
      ],
      policyHandle: 'service-standard',
    },
    {
      handle: 'equipment-upgrade-consult',
      name: 'Equipment & automation upgrade',
      description:
        'Trade an old, power-hungry setup for a modern one — variable-speed pumps, efficient heaters and phone-controlled automation that runs the whole pad. We size it to your pool and show the running-cost savings before you spend.',
      durationMinutes: 60,
      priceCents: 0,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'technician', kind: 'staff', skillTags: ['general'], count: 1 },
      ],
      policyHandle: 'project-consult',
    },
    {
      handle: 'resurfacing-consult',
      name: 'Resurfacing & renovation consult',
      description:
        'Rough plaster, stained tile or a dated shell? We walk the pool, talk through finishes and give you a clear renovation plan with a written estimate — resurfacing, tile, coping and deck, all in one scope.',
      durationMinutes: 60,
      priceCents: 0,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'technician', kind: 'staff', skillTags: ['general'], count: 1 },
      ],
      policyHandle: 'project-consult',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  typeHero({
    surface: 'primary',
    title: 'We fix what others can’t.',
    sub: 'AquaTech Pool & Spa is the crew you call when the pump quits, the heater codes out or the water keeps dropping. Certified technicians, all makes and models, an honest diagnosis and a fixed price before we touch a thing. Book a service call and get a real answer.',
    primary: { label: 'Book a service call', href: '/book' },
    secondary: { label: 'See service types', href: '/book' },
  }),
  featureRow({
    items: [
      {
        title: 'Certified technicians',
        body: 'Factory-trained, background-checked pros who repair equipment for a living — not a route driver taking a guess at your pump.',
      },
      {
        title: 'All makes & models',
        body: 'Pentair, Hayward, Jandy, Raypak and the rest — we carry the common parts and know the boards, so most repairs finish in one visit.',
      },
      {
        title: 'Upfront diagnostics',
        body: 'We trace the real fault and hand you a fixed price before any work starts. No surprise line items, no parts you didn’t need.',
      },
      {
        title: 'Equipment & automation upgrades',
        body: 'When a fix isn’t worth it, we size a modern, efficient replacement — variable-speed pumps and phone-controlled automation that pay you back.',
      },
    ],
  }),
  serviceMenu({
    heading: 'Repairs & service',
    intro: 'The service calls homeowners book most. Full details and live availability are on the booking page — pick a problem and a time.',
    surface: 'muted',
    columns: 2,
    items: [
      {
        name: 'Service call & diagnostic',
        priceCents: 8900,
        durationMin: 60,
        desc: 'We find the fault and quote a fixed repair — fee comes off the fix.',
      },
      {
        name: 'Pump & motor repair',
        priceCents: 14900,
        durationMin: 90,
        desc: 'Seals, bearings, motors and drives — usually done in one visit.',
      },
      {
        name: 'Leak detection',
        priceCents: 19900,
        durationMin: 120,
        desc: 'Pressure and dye testing to pinpoint a leak without tearing up the deck.',
      },
      {
        name: 'Heater & heat-pump repair',
        priceCents: 15900,
        durationMin: 90,
        desc: 'Gas and heat-pump faults read off the board and repaired, not reset.',
      },
    ],
    cta: { label: 'See all service types & book', href: '/book' },
  }),
  splitFeature({
    image: url(IMG.diagnostics),
    alt: 'A technician pressure-testing pool plumbing to trace a hidden leak',
    heading: 'The diagnosis is the whole job',
    body: [
      'Most pool problems get "fixed" three times because nobody found the real cause the first time. We do the opposite — pressure tests, dye tests, board readings and flow checks until we can point at exactly what’s wrong and why.',
      'Then you get it in plain language: the fault, what it takes to repair, and a fixed price to approve before we start. The equipment you own is complex; the answer you get from us isn’t.',
    ],
    cta: { label: 'Book a service call', href: '/book' },
  }),
  splitFeature({
    image: url(IMG.equipment),
    alt: 'A pool equipment pad with a variable-speed pump, heater and automation panel',
    heading: 'When a repair isn’t worth it',
    reverse: true,
    body: [
      'Sometimes the honest call is to stop repairing an old, power-hungry system and upgrade it. We’ll tell you when you’ve hit that line — and we’ll show you the math, not just push a sale.',
      'A right-sized variable-speed pump, an efficient heater and automation you run from your phone can cut a pool’s running cost dramatically. We size it to your pool, install it clean, and set it up so it just works.',
    ],
  }),
  teamRow({
    heading: 'The technicians you’ll meet',
    intro: 'Real specialists, background-checked and factory-trained — you’ll know who’s coming and what they’re expert in before they arrive.',
    members: [
      {
        name: 'Ray Alvarez',
        role: 'Repair & pump lead',
        image: url(IMG.ray),
        alt: 'Ray Alvarez, repair and pump lead',
        bio: 'Twenty years of pumps, motors and filtration across every major brand. Ray runs the repair calls.',
      },
      {
        name: 'Priya Nair',
        role: 'Leak & heater specialist',
        image: url(IMG.priya),
        alt: 'Priya Nair, leak and heater specialist',
        bio: 'Finds the leaks others miss and reads a heater board instead of guessing at parts.',
      },
      {
        name: 'Devin Cole',
        role: 'Renovation & automation lead',
        image: url(IMG.devin),
        alt: 'Devin Cole, renovation and automation lead',
        bio: 'Equipment upgrades, automation and full resurfacing — the bigger jobs, planned and done clean.',
      },
    ],
  }),
  testimonial({
    quote:
      'Two other companies swapped parts and charged us twice with no fix. AquaTech pressure-tested the line, found the crack in an afternoon and repaired it for a flat price. The pool has held water ever since.',
    attribution: 'The Delgado family, customers since 2024',
  }),
  bookingCta({
    title: 'Get a real diagnosis',
    sub: 'Book a service call or a free repair estimate and get an honest answer, a fixed price, and a crew that actually fixes it.',
    cta: { label: 'Book online', href: '/book' },
  }),
];

const BOOK_INTRO = [
  photoHero({
    image: url(IMG.spa),
    alt: 'A freshly resurfaced spa with clear water and new tile at dusk',
    title: 'Book a service call',
    sub: 'Choose a service to see what it covers, how long it takes and live availability — then pick your technician and time.',
    primary: { label: 'See service types below', href: '/book' },
    overlay: 'darker',
    align: 'start',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.equipment),
    alt: 'A pool equipment pad with a variable-speed pump, heater and automation panel',
    heading: 'About AquaTech Pool & Spa',
    body: [
      'We started AquaTech because too many pool owners get handed guesses — a swapped part, a big bill, and the same problem a month later. Pools and spas are real machinery, and machinery deserves a real diagnosis.',
      'We’re a small crew of factory-trained technicians who’d rather find the fault once than bill for it three times. Every job starts with tracing the actual cause, so you pay to fix the problem — not to chase it.',
    ],
    cta: { label: 'Book a service call', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'How we work',
    items: [
      {
        title: 'Diagnose first',
        body: 'Every repair starts with a real diagnosis — tested and confirmed, never a part swapped on a hunch.',
      },
      {
        title: 'Fixed prices',
        body: 'You approve a fixed price before any work begins, with parts and labor spelled out and estimates always free.',
      },
      {
        title: 'Built to last',
        body: 'Clean repairs, quality parts and honest upgrade advice, so the fix holds and the pool stays running.',
      },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Reach the shop',
    address: ['AquaTech Pool & Spa', '1820 Waterline Drive', 'Bay 6 · Chandler, AZ 85225'],
    mapLocation: '1820 Waterline Drive, Chandler, AZ 85225',
    hours: [
      { day: 'Monday – Friday', time: '7:00 – 5:00' },
      { day: 'Saturday', time: '8:00 – 4:00' },
      { day: 'Sunday', time: 'Closed' },
      { day: 'Emergencies', time: '24 / 7 on call' },
    ],
  }),
  bookingCta({
    title: 'Rather book than call?',
    sub: 'See live availability and reserve a technician online — pick a service, a day and a time in about a minute.',
    surface: 'muted',
    cta: { label: 'Book online', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-pool-repair',
  name: 'sparx — Pool & Spa (Repair)',
  summary:
    'A deep, technical pool & spa REPAIR site — a navy-teal palette with a bright cyan signal accent, built around online booking. Homeowners book a service call, a free repair estimate or a specialist consult in about a minute; three technicians carry their own skills and hours as dispatchable resources. Leads with certified techs, all makes & models and upfront diagnostics. Ships as "AquaTech Pool & Spa", an equipment-and-renovation specialist.',
  tagline: 'A deep, technical template for pool & spa repair pros — book service calls from day one.',
  industry: 'Pool service',
  sortWeight: 23,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'AquaTech Pool & Spa', tagline: 'We fix what others can’t.' },
  theme: aquatech,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'AquaTech Pool & Spa — expert pool & spa repair',
      description:
        'AquaTech Pool & Spa repairs pumps, heaters and leaks, and handles equipment, automation and resurfacing. Certified technicians, fixed prices. Book a service call online.',
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
