// sparx-pressurewash-commercial — "ProWash Exterior Cleaning", a COMMERCIAL exterior
// cleaning & pressure-washing company built around BOOKING A CONSULTATION / SITE ASSESSMENT.
//
// The contract-ready, professional side of pressure washing: storefronts and building
// facades, parking lots and garages, HOAs and property managers, and scheduled service
// contracts from a single crew. A deep slate ground with a sharp amber signal accent, a
// modern industrial sans display, and a commercial-contract page structure that leads with
// "insured, on schedule, minimal disruption" rather than a bright driveway before/after.
// Deliberately the OPPOSITE of the bright residential pressure-washing template — same
// booking spine, a different, professional business.
//
// The functional core is BOOKING A CONSULTATION: a free site assessment, a free quote or a
// scoped service consultation, each routed to a crew lead by skill. This file is JUST the
// SPEC; composition + emission + the section kit live in the shared service-sites/harness.ts.
// Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-pressurewash-commercial.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-pressurewash-commercial/**" \
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
  hero: 'pressurewash-commercial-hero',
  contract: 'pressurewash-commercial-contract',
  lot: 'pressurewash-commercial-lot',
  ray: 'pressurewash-commercial-ray',
  marcus: 'pressurewash-commercial-marcus',
  devon: 'pressurewash-commercial-devon',
} as const;

const PHOTO: Record<string, string> = {
  "prowash-hero": "https://images.unsplash.com/photo-1621831337128-35676ca30868?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y29tbWVyY2lhbCUyMGJ1aWxkaW5nJTIwZXh0ZXJpb3J8ZW58MHwwfHx8MTc4NjM5NTc0MXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prowash-contract": "https://images.unsplash.com/photo-1677956787377-a0f32c0974af?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cHJlc3N1cmUlMjB3YXNoaW5nJTIwY29tbWVyY2lhbHxlbnwwfDB8fHwxNzg2Mzk1NzQ0fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prowash-lot": "https://images.unsplash.com/photo-1636241166300-b801e6ddc0f4?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGFya2luZyUyMGxvdCUyMGJ1aWxkaW5nfGVufDB8MHx8fDE3ODYzOTU3NDd8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prowash-ray": "https://images.unsplash.com/photo-1530983822321-fcac2d3c0f06?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29ya2VyJTIwcG9ydHJhaXQlMjBtYW58ZW58MHwwfHx8MTc4NjM5NTcxMHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prowash-marcus": "https://images.unsplash.com/photo-1621905252507-b35492cc74b4?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y29udHJhY3RvciUyMHBvcnRyYWl0JTIwbWFufGVufDB8MHx8fDE3ODYzOTU3NDl8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prowash-devon": "https://images.unsplash.com/photo-1759521296144-fe6f2d2dc769?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29ya2VyJTIwcG9ydHJhaXQlMjB1bmlmb3JtfGVufDB8MHx8fDE3ODYzODkyNjJ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
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
    url: src('prowash-hero'),
    alt: 'A clean commercial storefront and glass facade along a city block',
  },
  {
    id: IMG.contract,
    url: src('prowash-contract'),
    alt: 'A technician soft-washing the exterior of a commercial building',
  },
  {
    id: IMG.lot,
    url: src('prowash-lot'),
    alt: 'A large commercial parking lot and multi-level garage from above',
  },
  { id: IMG.ray, url: src('prowash-ray'), alt: 'Ray Delgado, building and storefront lead' },
  { id: IMG.marcus, url: src('prowash-marcus'), alt: 'Marcus Hale, lots and garages lead' },
  { id: IMG.devon, url: src('prowash-devon'), alt: 'Devon Pierce, fleet and contracts lead' },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-pressurewash-commercial: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "slateworks": crisp near-white ground, deep navy-slate primary, dark steel
// secondary (readable micro-labels on light), a sharp amber signal accent, a modern
// industrial sans display. Small radii for a squared, professional feel ────────────────
const slateworks = defineTheme({
  name: 'slateworks',
  type: { body: face('Inter', 'sans-serif'), head: face('Archivo', 'sans-serif') },
  shape: { selector: '0.125rem', field: '0.125rem', box: '0.25rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(98% 0.004 250)', // crisp near-white
      'oklch(94% 0.006 252)', // cool mist
      'oklch(88% 0.01 255)', // hairline
      'oklch(22% 0.03 255)', // dark slate ink
    ],
    roles: {
      primary: 'oklch(33% 0.045 255)', // deep navy-slate
      secondary: 'oklch(38% 0.02 255)', // dark slate steel (readable micro-labels on light)
      accent: 'oklch(72% 0.15 68)', // sharp amber signal
      neutral: 'oklch(28% 0.02 255)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(20% 0.028 255)',
      'oklch(16% 0.022 255)',
      'oklch(13% 0.018 255)',
      'oklch(95% 0.004 250)',
    ],
    roles: {
      primary: 'oklch(64% 0.09 252)', // lifted slate-blue
      secondary: 'oklch(74% 0.02 250)', // light steel
      accent: 'oklch(78% 0.15 70)',
      neutral: 'oklch(82% 0.018 250)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the booking spine (policies, crew leads + hours, the consultation menu) ──
const hours = (days: number[], startMinute: number, endMinute: number) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

const SCHEDULING = {
  policies: [
    {
      handle: 'service-standard',
      name: 'Standard consultation',
      depositType: 'none',
      cancellationWindowHours: 48,
      reminderOffsetsMin: [2880, 120],
      policyText:
        'Give us at least 48 hours’ notice to change or cancel a consultation. We send a reminder two days ahead and two hours before, with your crew lead’s name and arrival window.',
    },
    {
      handle: 'service-contract',
      name: 'Scheduled service contract',
      depositType: 'none',
      cancellationWindowHours: 48,
      reminderOffsetsMin: [2880, 1440, 120],
      policyText:
        'Recurring and contract visits are scheduled ahead and reminded before each service, so your property stays on cadence with no surprises. Reschedule any single visit with 48 hours’ notice.',
    },
  ],
  resources: [
    {
      handle: 'ray',
      name: 'Ray Delgado',
      kind: 'staff',
      skillTags: ['building', 'storefront', 'general'],
      windows: [...hours([1, 2, 3, 4, 5], 360, 960), ...hours([6], 420, 780)], // Mon–Fri 6–4, Sat 7–1
    },
    {
      handle: 'marcus',
      name: 'Marcus Hale',
      kind: 'staff',
      skillTags: ['lot', 'garage', 'general'],
      windows: [...hours([1, 2, 3, 4, 5, 6], 300, 900), ...hours([0], 360, 720)], // Mon–Sat 5–3, Sun 6–12 (off-hours lot work)
    },
    {
      handle: 'devon',
      name: 'Devon Pierce',
      kind: 'staff',
      skillTags: ['fleet', 'contract', 'general'],
      windows: [...hours([2, 3, 4, 5, 6], 360, 1020), ...hours([1], 300, 660)], // Tue–Sat 6–5, early Mon 5–11
    },
  ],
  services: [
    {
      handle: 'site-assessment',
      name: 'On-site assessment',
      description:
        'A crew lead walks your property, sizes up every surface — facade, glass, walkways, lot — and flags what needs attention and how often. You leave with a clear scope and a plan. Always free, no obligation.',
      durationMinutes: 45,
      priceCents: 0,
      bufferAfterMin: 15,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'lead', kind: 'staff', skillTags: ['general'], count: 1 }],
      policyHandle: 'service-standard',
    },
    {
      handle: 'free-quote',
      name: 'Free quote',
      description:
        'Already know what you need cleaned? We measure the job, confirm access and timing, and send a written, itemized quote — one-time or on a schedule. No pressure, and always free.',
      durationMinutes: 30,
      priceCents: 0,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'lead', kind: 'staff', skillTags: ['general'], count: 1 }],
      policyHandle: 'service-standard',
    },
    {
      handle: 'storefront-cleaning-consult',
      name: 'Storefront cleaning consultation',
      description:
        'For retail fronts, restaurants and multi-tenant strips: an on-site scope with a small test wash so you see the result before you commit. The $49 fee is credited to your first service.',
      durationMinutes: 45,
      priceCents: 4900,
      bufferAfterMin: 10,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'lead', kind: 'staff', skillTags: ['general'], count: 1 }],
      policyHandle: 'service-standard',
    },
    {
      handle: 'building-washing-consult',
      name: 'Building washing consultation',
      description:
        'For low-rise offices, warehouses and apartment blocks: we assess the facade, choose the right soft-wash or pressure method for the material, and scope safe access. The $79 fee is credited to your first service.',
      durationMinutes: 60,
      priceCents: 7900,
      bufferAfterMin: 15,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'lead', kind: 'staff', skillTags: ['general'], count: 1 }],
      policyHandle: 'service-standard',
    },
    {
      handle: 'parking-lot-consult',
      name: 'Parking lot & garage consultation',
      description:
        'For lots, decks and multi-level garages: we scope the surface, gum and oil removal, drains and the after-hours window that keeps your traffic flowing. The $79 fee is credited to your first service.',
      durationMinutes: 60,
      priceCents: 7900,
      bufferAfterMin: 15,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'lead', kind: 'staff', skillTags: ['general'], count: 1 }],
      policyHandle: 'service-standard',
    },
    {
      handle: 'fleet-washing-consult',
      name: 'Fleet washing consultation',
      description:
        'For trucks, vans and equipment: we scope your fleet, wash cadence and on-site power and water needs, then price a recurring route that keeps every unit presentable. The $99 fee is credited to your first service.',
      durationMinutes: 60,
      priceCents: 9900,
      bufferAfterMin: 15,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'lead', kind: 'staff', skillTags: ['fleet'], count: 1 }],
      policyHandle: 'service-contract',
    },
    {
      handle: 'scheduled-contract-consult',
      name: 'Scheduled contract planning',
      description:
        'A planning session for property managers and multi-site operators: we map every location, set a cleaning cadence, and put it all under one insured contract with one point of contact. Free, and no obligation.',
      durationMinutes: 90,
      priceCents: 0,
      bufferAfterMin: 15,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'lead', kind: 'staff', skillTags: ['general'], count: 1 }],
      policyHandle: 'service-contract',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  photoHero({
    image: url(IMG.hero),
    alt: 'A clean commercial storefront and glass facade along a city block',
    title: 'Commercial exteriors, cleaned on schedule — without disrupting your business.',
    sub: 'ProWash Exterior Cleaning keeps storefronts, buildings, lots and fleets looking sharp for property managers and businesses across the region. Fully insured, contract-ready, and worked around your hours. Start with a free on-site assessment.',
    primary: { label: 'Book a consultation', href: '/book' },
    secondary: { label: 'See services', href: '/book' },
    overlay: 'darker',
    align: 'start',
  }),
  featureRow({
    items: [
      {
        title: 'Fully insured & compliant',
        body: 'Licensed, insured and trained on water-reclamation and safe-access rules — with certificates of insurance sent to your office before we ever set up.',
      },
      {
        title: 'Scheduled service contracts',
        body: 'One-time cleans or a recurring cadence under a single contract, so your properties stay presentable without you having to call and reschedule every time.',
      },
      {
        title: 'From storefronts to fleets',
        body: 'Glass facades, building exteriors, walkways, parking lots, garages and vehicle fleets — one crew and one point of contact for every exterior surface you own.',
      },
      {
        title: 'Minimal business disruption',
        body: 'We work early mornings, evenings and weekends, cordon cleanly and keep your entrances and traffic flowing — your customers barely notice we were there.',
      },
    ],
  }),
  serviceMenu({
    heading: 'Book a consultation',
    intro:
      'The assessments and consultations businesses book most. Full details and live availability are on the booking page — a lead comes to you.',
    surface: 'muted',
    columns: 2,
    items: [
      {
        name: 'On-site assessment',
        priceCents: 0,
        durationMin: 45,
        desc: 'A walk-through of every surface with a clear scope and plan. Free.',
      },
      {
        name: 'Free quote',
        priceCents: 0,
        durationMin: 30,
        desc: 'Know what you need? A written, itemized quote — one-time or scheduled.',
      },
      {
        name: 'Parking lot & garage consultation',
        priceCents: 7900,
        durationMin: 60,
        desc: 'Scope surface, gum and oil removal, drains and after-hours timing.',
      },
      {
        name: 'Scheduled contract planning',
        priceCents: 0,
        durationMin: 90,
        desc: 'Map every location and put it under one insured contract. Free.',
      },
    ],
    cta: { label: 'See all consultations & book', href: '/book' },
  }),
  splitFeature({
    image: url(IMG.contract),
    alt: 'A technician soft-washing the exterior of a commercial building',
    heading: 'Cleaning on a schedule, not a scramble',
    body: [
      'Grime, algae, gum and oil don’t take a season off — and chasing a different washer every time is how a property slips from sharp to shabby. A scheduled contract keeps it handled: we build a cadence around each surface and site, then simply show up.',
      'One insured contract covers every location and every surface you own, with one crew and one point of contact. You approve the plan once; we keep it looking its best on a rhythm you can budget around.',
    ],
    cta: { label: 'Plan a service contract', href: '/book' },
  }),
  splitFeature({
    image: url(IMG.lot),
    alt: 'A large commercial parking lot and multi-level garage from above',
    heading: 'How the on-site assessment works',
    reverse: true,
    body: [
      'A crew lead walks your property with you — checking the facade material, glass, walkways, drains and lot — and flags what needs attention, what method it calls for, and how often it should be done to stay ahead of buildup.',
      'You get a clear, written scope: the surfaces, the approach, the access and timing, and a price you can put in a budget. No jargon and no pressure — just a plan and honest numbers. The assessment is always free.',
    ],
  }),
  teamRow({
    heading: 'The crew leads you’ll work with',
    intro:
      'Real people, background-checked and trained — you’ll know who’s coming, what they specialize in, and when to expect them before they arrive.',
    members: [
      {
        name: 'Ray Delgado',
        role: 'Building & storefront lead',
        image: url(IMG.ray),
        alt: 'Ray Delgado, building and storefront lead',
        bio: 'Facades, glass and retail fronts done clean and streak-free — Ray runs most on-site assessments.',
      },
      {
        name: 'Marcus Hale',
        role: 'Lots & garages lead',
        image: url(IMG.marcus),
        alt: 'Marcus Hale, lots and garages lead',
        bio: 'Lots, decks and multi-level garages, worked the after-hours window so your traffic keeps moving.',
      },
      {
        name: 'Devon Pierce',
        role: 'Fleet & contracts lead',
        image: url(IMG.devon),
        alt: 'Devon Pierce, fleet and contracts lead',
        bio: 'Recurring fleet routes and multi-site contracts — Devon keeps every location on cadence.',
      },
    ],
  }),
  testimonial({
    quote:
      'ProWash took over exterior cleaning for eleven of our retail properties on one contract. The storefronts and lots stay sharp, the crews work after hours so tenants never notice, and I get one invoice instead of eleven headaches.',
    attribution: 'Renata Voss, regional property manager',
  }),
  bookingCta({
    title: 'See what a cleaner property looks like',
    sub: 'Book a free on-site assessment or a quote and get a clear, honest scope for your storefronts, buildings, lots or fleet — with numbers you can budget around.',
    cta: { label: 'Book a consultation', href: '/book' },
  }),
];

const BOOK_INTRO = [
  photoHero({
    image: url(IMG.lot),
    alt: 'A large commercial parking lot and multi-level garage from above',
    title: 'Book a consultation',
    sub: 'Choose an assessment or consultation to see what it covers, how long it takes and live availability — then pick your crew lead and time.',
    primary: { label: 'See consultation types below', href: '/book' },
    overlay: 'darker',
    align: 'start',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.hero),
    alt: 'A clean commercial storefront and glass facade along a city block',
    heading: 'About ProWash Exterior Cleaning',
    body: [
      'We started ProWash because commercial properties deserve better than a washer who shows up once, leaves streaks, and never answers the phone again. A clean exterior is the first thing a customer sees — it should be handled by people who treat it like it matters.',
      'We’re an insured, professional crew built for scheduled work: storefronts, building exteriors, lots, garages and fleets, kept sharp on a cadence you can rely on. One contract, one point of contact, and results you don’t have to chase.',
    ],
    cta: { label: 'Book a consultation', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'How we work',
    items: [
      {
        title: 'Assess first',
        body: 'Every scope starts with a real walk-through of your property — the right method for each surface, never a template quote guessed from the curb.',
      },
      {
        title: 'Insured & documented',
        body: 'Certificates of insurance, safe-access plans and water-reclamation compliance handled up front, so your risk and your legal team stay comfortable.',
      },
      {
        title: 'On cadence, on time',
        body: 'Recurring visits scheduled and reminded before each service — your property stays presentable without a single call from you.',
      },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Reach the yard',
    address: ['ProWash Exterior Cleaning', '2200 Industrial Parkway', 'Unit 7 · Beaverton, OR 97005'],
    mapLocation: '2200 Industrial Parkway, Beaverton, OR 97005',
    hours: [
      { day: 'Monday – Friday', time: '6:00 – 6:00' },
      { day: 'Saturday', time: '7:00 – 3:00' },
      { day: 'Sunday', time: 'By appointment' },
      { day: 'After-hours work', time: 'Scheduled on request' },
    ],
  }),
  bookingCta({
    title: 'Rather book than call?',
    sub: 'See live availability and reserve a crew lead online — pick an assessment or consultation, a day and a time in about a minute.',
    surface: 'muted',
    cta: { label: 'Book a consultation', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-pressurewash-commercial',
  name: 'Pressure Washing (Commercial)',
  summary:
    'A professional commercial exterior-cleaning site — a deep slate palette with a sharp amber accent, built around online booking. Property managers book a free site assessment, quote or service consultation in about a minute; three crew leads carry their own skills and hours as dispatchable resources. Leads with insured, scheduled service contracts from storefronts to fleets. Ships as "ProWash Exterior Cleaning", a commercial pressure-washing company.',
  tagline: 'A professional, contract-ready template for commercial exterior cleaning — book consultations from day one.',
  industry: 'Pressure washing',
  sortWeight: 7,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'ProWash Exterior Cleaning', tagline: 'Commercial exteriors, kept sharp.' },
  theme: slateworks,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'ProWash Exterior Cleaning — commercial pressure washing',
      description:
        'ProWash Exterior Cleaning keeps commercial storefronts, buildings, lots and fleets sharp — insured, on schedule, minimal disruption. Book a free assessment online.',
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
