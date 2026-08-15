// sparx-hvac-efficiency — "Northline Climate", a modern HVAC company built around
// ENERGY EFFICIENCY & SAVINGS.
//
// The data-forward, sustainability-minded side of home heating and cooling: high-efficiency
// systems, heat pumps, smart thermostats, rebates and lower monthly bills. A cool
// evergreen-and-slate palette on a near-white ground, a bright teal signal accent, a clean
// technical sans display, and a TYPE-FIRST hero that leads with numbers instead of a stock
// furnace photo. Deliberately the OPPOSITE of the warm/friendly comfort-duality HVAC
// template — same booking spine, a cooler, more technical business.
//
// The functional core is BOOKING A VISIT: an energy assessment, a free install estimate or
// a tune-up, each routed to a technician by skill. This file is JUST the SPEC; composition +
// emission + the section kit live in the shared service-sites/harness.ts. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-hvac-efficiency.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-hvac-efficiency/**" \
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
  system: 'hvac-efficiency-system',
  savings: 'hvac-efficiency-savings',
  assessment: 'hvac-efficiency-assessment',
  marco: 'hvac-efficiency-marco',
  dana: 'hvac-efficiency-dana',
  theo: 'hvac-efficiency-theo',
} as const;

const PHOTO: Record<string, string> = {
  "northline-system": "https://images.unsplash.com/photo-1700124113583-81aa99ea2aa2?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8aGVhdCUyMHB1bXAlMjB1bml0fGVufDB8MHx8fDE3ODYzODgyNTV8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "northline-savings": "https://images.unsplash.com/photo-1545259741-2ea3ebf61fa3?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c21hcnQlMjB0aGVybW9zdGF0JTIwaG9tZXxlbnwwfDB8fHwxNzg2Mzg4MjU4fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "northline-assessment": "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8aHZhYyUyMHRlY2huaWNpYW4lMjB3b3JraW5nfGVufDB8MHx8fDE3ODYzODgyNjF8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "northline-marco": "https://images.unsplash.com/photo-1506863530036-1efeddceb993?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dGVjaG5pY2lhbiUyMHBvcnRyYWl0fGVufDB8MHx8fDE3ODYzODgyNjR8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "northline-dana": "https://images.unsplash.com/photo-1581092570490-cc40829efaae?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjBlbmdpbmVlciUyMHBvcnRyYWl0fGVufDB8MHx8fDE3ODYzODgyNjd8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "northline-theo": "https://images.unsplash.com/photo-1676989880361-091e12efc056?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cHJvZmVzc2lvbmFsJTIwbWFuJTIwcG9ydHJhaXR8ZW58MHwwfHx8MTc4NjM4ODI2OXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
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
    id: IMG.system,
    url: src('northline-system'),
    alt: 'A high-efficiency heat-pump unit installed neatly beside a home',
  },
  {
    id: IMG.savings,
    url: src('northline-savings'),
    alt: 'A smart thermostat on a wall showing a comfortable, lower target temperature',
  },
  {
    id: IMG.assessment,
    url: src('northline-assessment'),
    alt: 'A technician checking a home for drafts and energy loss with a meter',
  },
  { id: IMG.marco, url: src('northline-marco'), alt: 'Marco Ellis, heat-pump lead' },
  { id: IMG.dana, url: src('northline-dana'), alt: 'Dana Whitfield, service technician' },
  { id: IMG.theo, url: src('northline-theo'), alt: 'Theo Park, install technician' },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-hvac-efficiency: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "northline": cool near-white ground, evergreen primary, slate steel secondary,
// a bright teal signal accent, a clean technical sans display ─────────────────────────────
const northline = defineTheme({
  name: 'northline',
  type: { body: face('Inter', 'sans-serif'), head: face('Space Grotesk', 'sans-serif') },
  shape: { selector: '0.25rem', field: '0.25rem', box: '0.375rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(98% 0.006 200)', // cool near-white
      'oklch(94% 0.009 205)', // cool mist
      'oklch(89% 0.011 210)', // hairline
      'oklch(24% 0.02 240)', // dark slate ink
    ],
    roles: {
      primary: 'oklch(47% 0.11 155)', // deep evergreen
      secondary: 'oklch(37% 0.022 240)', // dark slate steel (readable micro-labels on light)
      accent: 'oklch(70% 0.14 182)', // bright teal signal
      neutral: 'oklch(30% 0.016 240)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(22% 0.02 240)',
      'oklch(18% 0.016 240)',
      'oklch(14% 0.012 240)',
      'oklch(95% 0.006 200)',
    ],
    roles: {
      primary: 'oklch(62% 0.12 158)', // lifted evergreen
      secondary: 'oklch(74% 0.02 230)', // light steel
      accent: 'oklch(76% 0.14 184)',
      neutral: 'oklch(82% 0.016 230)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the booking spine (policies, technicians + hours, the visit menu) ─────
const hours = (days: number[], startMinute: number, endMinute: number) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

const SCHEDULING = {
  policies: [
    {
      handle: 'visit-standard',
      name: 'Standard visit',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [1440, 120],
      policyText:
        'Give us at least 24 hours’ notice to change or cancel a visit. We text a reminder the day before and two hours ahead, with your technician’s name and arrival window.',
    },
    {
      handle: 'maintenance-plan',
      name: 'Maintenance plan',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [2880, 1440, 120],
      policyText:
        'Seasonal maintenance visits are scheduled ahead and reminded twice, so your system is tuned before you need it. Reschedule any time with a day’s notice.',
    },
  ],
  resources: [
    {
      handle: 'marco',
      name: 'Marco Ellis',
      kind: 'staff',
      skillTags: ['heat-pump', 'install', 'assessment'],
      windows: hours([1, 2, 3, 4, 5], 420, 960), // Mon–Fri 7–4
    },
    {
      handle: 'dana',
      name: 'Dana Whitfield',
      kind: 'staff',
      skillTags: ['tune-up', 'repair', 'smart'],
      windows: hours([1, 2, 3, 4, 5, 6], 480, 1020), // Mon–Sat 8–5
    },
    {
      handle: 'theo',
      name: 'Theo Park',
      kind: 'staff',
      skillTags: ['install', 'ductwork', 'assessment'],
      windows: hours([2, 3, 4, 5, 6], 420, 960), // Tue–Sat 7–4
    },
  ],
  services: [
    {
      handle: 'energy-assessment',
      name: 'Home energy assessment',
      description:
        'A room-by-room look at where your home loses heating and cooling — insulation, drafts, ductwork and your current system — with a plain-language report and the changes that would cut your bills the most. The $49 fee comes off any work you book.',
      durationMinutes: 90,
      priceCents: 4900,
      bufferAfterMin: 15,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'tech', kind: 'staff', skillTags: ['assessment'], count: 1 },
      ],
      policyHandle: 'visit-standard',
    },
    {
      handle: 'free-install-estimate',
      name: 'Free install estimate',
      description:
        'Thinking about a new furnace, AC or heat pump? We measure your home, size the system properly and give you a written, no-pressure quote — including any rebates and financing you qualify for. Always free.',
      durationMinutes: 60,
      priceCents: 0,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'tech', kind: 'staff', skillTags: ['assessment'], count: 1 },
      ],
      policyHandle: 'visit-standard',
    },
    {
      handle: 'heat-pump-consult',
      name: 'Heat-pump consultation',
      description:
        'A focused sit-down on whether a heat pump fits your home — how it heats and cools with one efficient system, what it would cost to run, and the rebates that bring it down. Free, and no obligation to buy.',
      durationMinutes: 45,
      priceCents: 0,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'tech', kind: 'staff', skillTags: ['heat-pump'], count: 1 },
      ],
      policyHandle: 'visit-standard',
    },
    {
      handle: 'efficiency-tune-up',
      name: 'Efficiency tune-up',
      description:
        'A full clean-and-check that keeps your system running at its rated efficiency — cleaner air, quieter operation and lower bills. Cleared coils, fresh filter, calibrated controls and a safety check.',
      durationMinutes: 75,
      priceCents: 12900,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'tech', kind: 'staff', skillTags: ['tune-up'], count: 1 },
      ],
      policyHandle: 'visit-standard',
    },
    {
      handle: 'smart-thermostat-install',
      name: 'Smart thermostat install',
      description:
        'We supply and fit a smart thermostat, wire it to your system and set up the schedule that saves you the most — so your home eases back when you’re out and is comfortable the moment you’re home.',
      durationMinutes: 90,
      priceCents: 18900,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'tech', kind: 'staff', skillTags: ['smart'], count: 1 }],
      policyHandle: 'visit-standard',
    },
    {
      handle: 'system-diagnostic',
      name: 'System diagnostic',
      description:
        'Not heating or cooling like it should, or running your bill up? A technician traces the fault, explains it in plain terms and gives you a fixed price to repair before any work starts.',
      durationMinutes: 60,
      priceCents: 9900,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'tech', kind: 'staff', skillTags: ['repair'], count: 1 }],
      policyHandle: 'visit-standard',
    },
    {
      handle: 'maintenance-visit',
      name: 'Seasonal maintenance visit',
      description:
        'The twice-a-year visit that keeps a system efficient and heads off breakdowns — a spring cooling check and a fall heating check, each a full tune, safety inspection and efficiency report.',
      durationMinutes: 120,
      priceCents: 16900,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'tech', kind: 'staff', skillTags: ['tune-up'], count: 1 },
      ],
      policyHandle: 'maintenance-plan',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  typeHero({
    surface: 'primary',
    title: 'Lower bills. Cleaner comfort. A home that runs on less.',
    sub: 'Northline Climate designs, installs and tunes high-efficiency heating and cooling — heat pumps, smart controls and the small fixes that quietly cut your energy use. Start with an energy assessment and see the savings before you spend.',
    primary: { label: 'Book an energy assessment', href: '/book' },
    secondary: { label: 'See visit types', href: '/book' },
  }),
  featureRow({
    items: [
      {
        title: 'Heat-pump specialists',
        body: 'One efficient system that heats and cools your whole home — sized and installed by the people who do it every day, not as an afterthought.',
      },
      {
        title: 'Rebate & financing help',
        body: 'We find the utility rebates and tax credits you qualify for and handle the paperwork, then lay out financing so a better system fits your budget.',
      },
      {
        title: 'High-efficiency systems',
        body: 'We fit equipment rated to use markedly less energy for the same comfort — the difference shows up on every bill, not just the first one.',
      },
      {
        title: 'Lower monthly bills',
        body: 'Right-sized systems, sealed ducts and smart schedules mean your home stops paying to heat and cool empty rooms.',
      },
    ],
  }),
  serviceMenu({
    heading: 'Book a visit',
    intro: 'A few of the visits homeowners book most. Full details and live availability are on the booking page.',
    surface: 'muted',
    columns: 2,
    items: [
      {
        name: 'Home energy assessment',
        priceCents: 4900,
        durationMin: 90,
        desc: 'Find where your home loses energy — fee comes off any work.',
      },
      {
        name: 'Free install estimate',
        priceCents: 0,
        durationMin: 60,
        desc: 'A written, no-pressure quote with rebates and financing.',
      },
      {
        name: 'Smart thermostat install',
        priceCents: 18900,
        durationMin: 90,
        desc: 'Supplied, fitted and set up to save you the most.',
      },
      {
        name: 'Efficiency tune-up',
        priceCents: 12900,
        durationMin: 75,
        desc: 'A clean-and-check that keeps a system at its rated efficiency.',
      },
    ],
    cta: { label: 'See all visit types & book', href: '/book' },
  }),
  splitFeature({
    image: url(IMG.savings),
    alt: 'A smart thermostat on a wall showing a comfortable, lower target temperature',
    heading: 'Small changes, real savings',
    body: [
      'Efficiency isn’t one big purchase — it’s a stack of smaller wins: a properly sized system, sealed ducts, a smart schedule and equipment that does more with less power. Together they take a real bite out of what you pay each month.',
      'We start by measuring where your money is actually going, then show you the changes that pay back fastest — with any rebates and financing spelled out up front, in dollars, before you decide anything.',
    ],
    cta: { label: 'Book an energy assessment', href: '/book' },
  }),
  splitFeature({
    image: url(IMG.assessment),
    alt: 'A technician checking a home for drafts and energy loss with a meter',
    heading: 'How the energy assessment works',
    reverse: true,
    body: [
      'A technician walks your home room by room — checking insulation, hunting for drafts, inspecting the ductwork and testing how your current system actually performs against what it’s rated to do.',
      'You get a plain-language report: what’s costing you, what it would take to fix, and the handful of changes that would cut your bills the most. No jargon, no upsell — just a clear picture and a price. The $49 fee comes off any work you book.',
    ],
  }),
  teamRow({
    heading: 'The technicians you’ll meet',
    intro: 'Real people, background-checked and factory-trained — you’ll know who’s coming and what they specialize in before they arrive.',
    members: [
      {
        name: 'Marco Ellis',
        role: 'Heat-pump lead',
        image: url(IMG.marco),
        alt: 'Marco Ellis, heat-pump lead',
        bio: 'Sizes and installs heat pumps for homes of every shape. Marco runs the efficiency assessments.',
      },
      {
        name: 'Dana Whitfield',
        role: 'Service technician',
        image: url(IMG.dana),
        alt: 'Dana Whitfield, service technician',
        bio: 'Tune-ups, diagnostics and smart-thermostat setups — the visits that keep bills low year-round.',
      },
      {
        name: 'Theo Park',
        role: 'Install technician',
        image: url(IMG.theo),
        alt: 'Theo Park, install technician',
        bio: 'New systems and ductwork done clean and sealed tight, so the efficiency you paid for stays in.',
      },
    ],
  }),
  testimonial({
    quote:
      'They swapped our old furnace and AC for one heat pump, sealed the ducts and set up the thermostat. Our winter gas bill dropped by about a third — and the house is finally warm in every room.',
    attribution: 'The Okafor family, customers since 2024',
  }),
  bookingCta({
    title: 'See your savings before you spend',
    sub: 'Book an energy assessment or a free install estimate and get a clear, honest picture of what a more efficient home would cost — and save.',
    cta: { label: 'Book online', href: '/book' },
  }),
];

const BOOK_INTRO = [
  photoHero({
    image: url(IMG.system),
    alt: 'A high-efficiency heat-pump unit installed neatly beside a home',
    title: 'Book your visit',
    sub: 'Choose a visit to see what it covers, how long it takes and live availability — then pick your technician and time.',
    primary: { label: 'See visit types below', href: '/book' },
    overlay: 'darker',
    align: 'start',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.system),
    alt: 'A high-efficiency heat-pump unit installed neatly beside a home',
    heading: 'About Northline Climate',
    body: [
      'We started Northline Climate because too many homes are heated and cooled by oversized, worn-out systems that cost a fortune to run. There’s a better way, and it isn’t complicated — the right equipment, installed properly, tuned to your home.',
      'We’re a small, factory-trained crew who’d rather right-size a system than oversell one. Every job starts by measuring what your home actually needs, so you pay for comfort, not wasted energy.',
    ],
    cta: { label: 'Book an energy assessment', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'How we work',
    items: [
      {
        title: 'Measure first',
        body: 'Every recommendation starts with a real look at your home and system — never a guess or a template quote.',
      },
      {
        title: 'Honest numbers',
        body: 'Written quotes, fixed repair prices, and rebates and financing laid out in dollars before you commit to anything.',
      },
      {
        title: 'Efficiency that lasts',
        body: 'Clean installs, sealed ducts and seasonal tune-ups keep the savings coming long after the work is done.',
      },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Reach the shop',
    address: ['Northline Climate', '3400 Foundry Road', 'Bay 4 · Beaverton, OR 97005'],
    mapLocation: '3400 Foundry Road, Beaverton, OR 97005',
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
  key: 'sparx-hvac-efficiency',
  name: 'HVAC (Efficiency)',
  summary:
    'A data-forward HVAC site for energy-efficiency pros — a cool evergreen-and-slate palette with a bright teal signal accent, built around online booking. Homeowners book an energy assessment, a free install estimate or a tune-up in about a minute; three technicians carry their own skills and hours. Leads with lower bills, heat-pump expertise and rebate help. Ships as "Northline Climate", a high-efficiency heating-and-cooling company.',
  tagline: 'A cool, technical template for efficiency-focused HVAC — book visits from day one.',
  industry: 'HVAC',
  sortWeight: 75,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'Northline Climate', tagline: 'Comfort that costs less.' },
  theme: northline,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Northline Climate — high-efficiency heating & cooling',
      description:
        'Northline Climate installs and tunes high-efficiency HVAC — heat pumps, smart thermostats and the fixes that cut your bills. Book an energy assessment online.',
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
