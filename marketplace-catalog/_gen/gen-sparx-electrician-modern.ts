// sparx-electrician-modern — "Voltline Electric", a MODERN electrical contractor.
//
// The sleek, high-tech electrician of the future home & business: EV chargers, smart-home
// & automation, solar/battery hookups, panel modernization and commercial fit-outs. A
// near-black graphite ground held dark in BOTH light and dark modes, an ELECTRIC-BLUE
// primary and a bright cyan accent, tight low-radius chrome, and a bold TYPE-FIRST hero —
// forward, technical, confident. Deliberately the OPPOSITE of the warm safety-yellow
// residential electrician sibling (bright, friendly, photo-led) — same booking spine, a
// different business.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-electrician-modern.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-electrician-modern/**" \
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
  hero: 'electrician-modern-hero',
  panel: 'electrician-modern-panel',
  ev: 'electrician-modern-ev',
  nadia: 'electrician-modern-nadia',
  theo: 'electrician-modern-theo',
  ruben: 'electrician-modern-ruben',
  work1: 'electrician-modern-work1',
  work2: 'electrician-modern-work2',
  work3: 'electrician-modern-work3',
} as const;

const PHOTO: Record<string, string> = {
  "voltline-hero": "https://images.unsplash.com/photo-1593941707874-ef25b8b4a92b?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZXYlMjBjaGFyZ2VyJTIwZWxlY3RyaWMlMjBjYXJ8ZW58MHwwfHx8MTc4NjM4ODI5Mnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "voltline-panel": "https://images.unsplash.com/photo-1576446470246-499c738d1c8e?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZWxlY3RyaWNhbCUyMHBhbmVsJTIwbW9kZXJufGVufDB8MHx8fDE3ODYzODgyOTV8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "voltline-ev": "https://images.unsplash.com/photo-1593941707874-ef25b8b4a92b?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZWxlY3RyaWMlMjB2ZWhpY2xlJTIwY2hhcmdpbmd8ZW58MHwwfHx8MTc4NjM4ODI5OHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "voltline-nadia": "https://images.unsplash.com/photo-1581092570490-cc40829efaae?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjBlbmdpbmVlciUyMHBvcnRyYWl0fGVufDB8MHx8fDE3ODYzODgyNjd8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "voltline-theo": "https://images.unsplash.com/photo-1676989880361-091e12efc056?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cHJvZmVzc2lvbmFsJTIwbWFuJTIwcG9ydHJhaXR8ZW58MHwwfHx8MTc4NjM4ODI2OXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "voltline-ruben": "https://images.unsplash.com/photo-1764014353079-08ece464a226?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dGVjaG5pY2lhbiUyMHBvcnRyYWl0JTIwbWFufGVufDB8MHx8fDE3ODYzODgyNDl8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "voltline-work1": "https://images.unsplash.com/photo-1558002038-1055907df827?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c21hcnQlMjBob21lJTIwZGV2aWNlfGVufDB8MHx8fDE3ODYzODgzMDF8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "voltline-work2": "https://images.unsplash.com/photo-1509391366360-2e959784a276?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c29sYXIlMjBwYW5lbCUyMGluc3RhbGxhdGlvbnxlbnwwfDB8fHwxNzg2Mzg4MzAzfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "voltline-work3": "https://images.unsplash.com/photo-1660330589693-99889d60181e?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZWxlY3RyaWNhbCUyMHdvcmslMjBtb2Rlcm58ZW58MHwwfHx8MTc4NjM4ODMwNnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
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
    url: src('voltline-hero'),
    alt: 'A modern home at dusk with an EV charging in the driveway',
  },
  {
    id: IMG.panel,
    url: src('voltline-panel'),
    alt: 'A clean, labelled electrical panel and smart-home control hub',
  },
  {
    id: IMG.ev,
    url: src('voltline-ev'),
    alt: 'An electric car plugged into a wall-mounted home charger',
  },
  { id: IMG.nadia, url: src('voltline-nadia'), alt: 'Nadia Okafor, master electrician' },
  { id: IMG.theo, url: src('voltline-theo'), alt: 'Theo Marsh, smart-home and solar specialist' },
  { id: IMG.ruben, url: src('voltline-ruben'), alt: 'Ruben Diaz, commercial electrician' },
  { id: IMG.work1, url: src('voltline-work1'), alt: 'A newly installed EV charger on a garage wall' },
  { id: IMG.work2, url: src('voltline-work2'), alt: 'A modernized breaker panel with tidy wiring' },
  { id: IMG.work3, url: src('voltline-work3'), alt: 'A wall-mounted home battery beside solar equipment' },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-electrician-modern: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "voltline": near-black graphite ground (dark in BOTH modes), electric-blue
//    primary, bright cyan accent, light ink, tight low-radius chrome, a modern sharp sans ──
const voltline = defineTheme({
  name: 'voltline',
  type: { body: face('Inter', 'sans-serif'), head: face('Space Grotesk', 'sans-serif') },
  shape: { selector: '0.25rem', field: '0.25rem', box: '0.25rem', depth: '0' },
  light: {
    // A high-tech ground even in "light" mode: near-black graphite surfaces, cool light ink.
    surfaces: [
      'oklch(17% 0.018 255)', // graphite / near-black
      'oklch(14% 0.016 255)', // deeper panel
      'oklch(30% 0.02 255)', // hairline (lifted so borders read on dark)
      'oklch(93% 0.01 250)', // cool light ink
    ],
    roles: {
      primary: 'oklch(68% 0.17 240)', // electric blue
      secondary: 'oklch(82% 0.03 235)', // light steel (legible light-on-dark)
      accent: 'oklch(80% 0.14 200)', // bright cyan / volt
      neutral: 'oklch(80% 0.012 250)',
      ...STATUS_ON_DARK,
    },
  },
  dark: {
    // A touch darker still.
    surfaces: [
      'oklch(14% 0.016 255)',
      'oklch(11% 0.014 255)',
      'oklch(26% 0.02 255)',
      'oklch(94% 0.01 250)',
    ],
    roles: {
      primary: 'oklch(72% 0.17 240)',
      secondary: 'oklch(84% 0.03 235)',
      accent: 'oklch(83% 0.14 200)',
      neutral: 'oklch(84% 0.012 250)',
      ...STATUS_ON_DARK,
    },
  },
});
// NOTE: this theme is dark in BOTH modes (a high-tech shop even in "light"), so both
// palettes take STATUS_ON_DARK — the on-light status set never applies here.

// ── Scheduling — the booking spine (policies, electricians + hours, the visit menu) ─────
const hours = (days: number[], startMinute: number, endMinute: number) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

const SCHEDULING = {
  policies: [
    {
      handle: 'voltline-standard',
      name: 'Standard visit',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [1440, 120],
      policyText:
        'Please give us at least 24 hours’ notice to change or cancel a visit. We text a reminder the day before and two hours ahead, with your electrician’s name and arrival window.',
    },
    {
      handle: 'voltline-priority',
      name: 'Commercial / priority',
      depositType: 'none',
      cancellationWindowHours: 48,
      reminderOffsetsMin: [2880, 1440, 120],
      policyText:
        'Larger commercial jobs are scheduled around a crew, so we ask for 48 hours’ notice to reschedule. We confirm the visit once we’ve reviewed the site details you send.',
    },
  ],
  resources: [
    {
      handle: 'nadia',
      name: 'Nadia Okafor',
      kind: 'staff',
      skillTags: ['ev', 'panel', 'assessment'],
      windows: hours([1, 2, 3, 4, 5], 450, 990), // Mon–Fri 7:30–4:30
    },
    {
      handle: 'theo',
      name: 'Theo Marsh',
      kind: 'staff',
      skillTags: ['smart-home', 'install', 'solar'],
      windows: hours([2, 3, 4, 5, 6], 480, 1020), // Tue–Sat 8–5
    },
    {
      handle: 'ruben',
      name: 'Ruben Diaz',
      kind: 'staff',
      skillTags: ['commercial', 'panel', 'assessment'],
      windows: hours([1, 2, 3, 4, 5], 420, 930), // Mon–Fri 7–3:30
    },
  ],
  services: [
    {
      handle: 'site-assessment',
      name: 'Home site assessment',
      description:
        'An electrician walks your home, checks your panel and wiring, and maps out what your project needs — the honest starting point for any bigger job.',
      durationMinutes: 90,
      priceCents: 9900,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'electrician', kind: 'staff', skillTags: ['assessment'], count: 1 },
      ],
      policyHandle: 'voltline-standard',
    },
    {
      handle: 'ev-charger-consult',
      name: 'EV charger install consult',
      description:
        'We look at where you park, your panel’s spare capacity and the cable run, then quote a wall charger sized to your car. Free, no obligation.',
      durationMinutes: 45,
      priceCents: 0,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'electrician', kind: 'staff', skillTags: ['ev'], count: 1 }],
      policyHandle: 'voltline-standard',
    },
    {
      handle: 'free-estimate',
      name: 'Free estimate',
      description:
        'Have a specific job in mind? Book a no-cost visit and leave with a clear, written price — no surprises, no pressure.',
      durationMinutes: 45,
      priceCents: 0,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'electrician', kind: 'staff', skillTags: ['assessment'], count: 1 },
      ],
      policyHandle: 'voltline-standard',
    },
    {
      handle: 'smart-home-consult',
      name: 'Smart-home & automation consult',
      description:
        'Lighting, switches, sensors and hubs that actually talk to each other. We plan a setup that fits how you live — plainly explained, nothing over-sold.',
      durationMinutes: 60,
      priceCents: 0,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'electrician', kind: 'staff', skillTags: ['smart-home'], count: 1 },
      ],
      policyHandle: 'voltline-standard',
    },
    {
      handle: 'panel-modernization-consult',
      name: 'Panel modernization consult',
      description:
        'An older or maxed-out breaker panel is the quiet limit on everything else. We assess yours and lay out an upgrade path, permits and all.',
      durationMinutes: 75,
      priceCents: 4900,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'electrician', kind: 'staff', skillTags: ['panel'], count: 1 },
      ],
      policyHandle: 'voltline-standard',
    },
    {
      handle: 'solar-battery-hookup-consult',
      name: 'Solar & battery hookup consult',
      description:
        'Adding panels or a home battery? We handle the electrical side — the connection, the transfer switch and the inspection — and explain the rebates you qualify for.',
      durationMinutes: 90,
      priceCents: 4900,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'electrician', kind: 'staff', skillTags: ['solar'], count: 1 },
      ],
      policyHandle: 'voltline-standard',
    },
    {
      handle: 'commercial-site-visit',
      name: 'Commercial site visit',
      description:
        'A scoping visit for a fit-out, tenant improvement or facility upgrade. Send the basics when you book and we’ll confirm a crewed time to walk the site.',
      durationMinutes: 120,
      priceCents: 0,
      requiresApproval: true,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'electrician', kind: 'staff', skillTags: ['commercial'], count: 1 },
      ],
      policyHandle: 'voltline-priority',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  typeHero({
    title: 'Wire your home for what’s next',
    sub: 'EV chargers, smart-home wiring, solar and battery hookups, and panel upgrades — done by certified electricians, for homes and businesses. Book a site assessment and see exactly what your place needs.',
    primary: { label: 'Book a site assessment', href: '/book' },
    secondary: { label: 'See visit types', href: '/book' },
    surface: 'primary',
  }),
  featureRow({
    items: [
      {
        title: 'Certified EV & panel specialists',
        body: 'Wall chargers and breaker-panel upgrades are our core work — sized right, permitted, and inspected, so your home keeps up with your car.',
      },
      {
        title: 'Smart-home & solar, done right',
        body: 'Lighting, automation, solar and home batteries that actually work together. We handle the electrical side and explain it in plain language.',
      },
      {
        title: 'Rebates, permits & inspections handled',
        body: 'We pull the permits, book the inspection, and walk you through the rebates you qualify for — residential or commercial, start to finish.',
      },
    ],
  }),
  serviceMenu({
    heading: 'Book a visit',
    intro: 'Every project starts with someone on-site. Pick a visit type to see live availability — many are free, and none commit you to anything.',
    surface: 'muted',
    columns: 2,
    items: [
      {
        name: 'EV charger install consult',
        priceCents: 0,
        durationMin: 45,
        desc: 'Right-sized home charger, quoted on-site — free.',
      },
      {
        name: 'Home site assessment',
        priceCents: 9900,
        durationMin: 90,
        desc: 'A full walk-through and a plan for your project.',
      },
      {
        name: 'Panel modernization consult',
        priceCents: 4900,
        durationMin: 75,
        desc: 'An upgrade path for an older or maxed-out panel.',
      },
      {
        name: 'Solar & battery hookup consult',
        priceCents: 4900,
        durationMin: 90,
        desc: 'The electrical side of going solar, rebates included.',
      },
    ],
    cta: { label: 'See everything & book', href: '/book' },
  }),
  splitFeature({
    image: url(IMG.ev),
    alt: 'An electric car plugged into a wall-mounted home charger',
    heading: 'Is your home ready for an EV?',
    body: [
      'Most homes can charge an electric car overnight — but only if the panel has room and the charger is wired to match your vehicle. Guess wrong and you get slow charging or a tripped breaker.',
      'Our EV consult settles it in one visit: we check your panel’s spare capacity, measure the cable run to where you park, and quote a charger that fits. If the panel needs a little work first, you’ll know before you spend a cent.',
    ],
    cta: { label: 'Book an EV consult', href: '/book' },
  }),
  teamRow({
    heading: 'The electricians you’ll meet',
    intro: 'Licensed, background-checked, and used to explaining the wiring, not just doing it. Book the specialist your job needs.',
    members: [
      {
        name: 'Nadia Okafor',
        role: 'Master electrician',
        image: url(IMG.nadia),
        alt: 'Nadia Okafor, master electrician',
        bio: 'Leads EV installs and panel upgrades. Twelve years in the trade and every permit signed off first time.',
      },
      {
        name: 'Theo Marsh',
        role: 'Smart-home & solar specialist',
        image: url(IMG.theo),
        alt: 'Theo Marsh, smart-home and solar specialist',
        bio: 'Automation, solar tie-ins and home batteries — the connected-home side of the business.',
      },
      {
        name: 'Ruben Diaz',
        role: 'Commercial electrician',
        image: url(IMG.ruben),
        alt: 'Ruben Diaz, commercial electrician',
        bio: 'Fit-outs, tenant improvements and facility upgrades — the crewed commercial jobs.',
      },
    ],
  }),
  galleryStrip({
    heading: 'Recent installs',
    surface: 'muted',
    columns: 3,
    images: [
      { src: url(IMG.work1), alt: 'A newly installed EV charger on a garage wall' },
      { src: url(IMG.work2), alt: 'A modernized breaker panel with tidy wiring' },
      { src: url(IMG.work3), alt: 'A wall-mounted home battery beside solar equipment' },
    ],
  }),
  testimonial({
    quote: 'They installed our EV charger and upgraded the panel in a day, explained every step, and the inspection passed on the first try. Finally an electrician who treats the house like the future, not the past.',
    attribution: 'Dana R., homeowner',
  }),
  bookingCta({
    title: 'Ready to plan your project?',
    sub: 'Pick a visit type, choose a day, and see live times. Most consults are free and take about a minute to book.',
    cta: { label: 'Book online', href: '/book' },
  }),
];

const BOOK_INTRO = [
  photoHero({
    image: url(IMG.panel),
    alt: 'A clean, labelled electrical panel and smart-home control hub',
    title: 'Book a visit',
    sub: 'Choose the visit that fits your project to see live availability, then pick your electrician and time. Free consults are marked $0.',
    primary: { label: 'See visit types below', href: '/book' },
    overlay: 'darker',
    align: 'start',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.hero),
    alt: 'A modern home at dusk with an EV charging in the driveway',
    heading: 'About Voltline Electric',
    body: [
      'Voltline started with a simple frustration: too many homes and businesses were being wired for how things used to be, not for EVs, solar, batteries and everything now plugged into the wall. We built the kind of electrical company we wished we could hire.',
      'We’re a small, certified crew that does the modern work well — chargers, panels, automation, solar tie-ins and commercial fit-outs — and we explain it in plain language, permits and inspections included. No jargon, no upsell, no surprises on the bill.',
    ],
    cta: { label: 'Book a visit', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'How we work',
    items: [
      {
        title: 'Assess before we quote',
        body: 'Every job starts with someone on-site looking at your actual panel and wiring — so the price you get is the price it costs.',
      },
      {
        title: 'Code, permits & inspections',
        body: 'We pull the permits and book the inspection as part of the job. You get work that’s done right and signed off, not a shortcut.',
      },
      {
        title: 'Explained in plain language',
        body: 'You’ll understand what we’re doing and why, and what it means for your rebates and your bill. Questions are welcome, always.',
      },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Reach the shop',
    address: ['Voltline Electric', '2200 Current Avenue', 'Unit 4 · Denver, CO 80216'],
    mapLocation: '2200 Current Avenue, Denver, CO 80216',
    hours: [
      { day: 'Monday – Friday', time: '7:00 – 5:00' },
      { day: 'Saturday', time: '8:00 – 2:00' },
      { day: 'Sunday', time: 'Closed' },
      { day: 'Emergencies', time: 'Call the line' },
    ],
  }),
  bookingCta({
    title: 'Rather book than call?',
    sub: 'See live availability and reserve an electrician online — pick a visit type, a day and a time, no phone tag.',
    surface: 'muted',
    cta: { label: 'Book online', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-electrician-modern',
  name: 'Electrician (Modern)',
  summary:
    'A sleek, high-tech electrical-contractor site — a near-black graphite palette with an electric-blue accent and a bold type-first hero, built for the modern home and business: EV chargers, smart-home wiring, solar and battery hookups, and panel upgrades. Installs a working booking flow: real visit types (site assessment, EV-charger consult, free estimate), three electricians you book by skill with their own hours, and a priority policy for commercial jobs. Ships as "Voltline Electric".',
  tagline: 'A modern, high-tech template for electricians — book visits online from day one.',
  industry: 'Electrician',
  sortWeight: 73,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'Voltline Electric', tagline: 'Wired for what’s next.' },
  theme: voltline,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Voltline Electric — a modern electrical contractor',
      description:
        'Voltline Electric wires the modern home and business: EV chargers, smart-home, solar and battery hookups, and panel upgrades. Book a site assessment or free consult online.',
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
