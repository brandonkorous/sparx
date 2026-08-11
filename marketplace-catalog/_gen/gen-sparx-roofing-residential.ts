// sparx-roofing-residential — "Summit Roofing", a TRUSTED residential roofing company.
//
// The dependable, been-doing-this-for-years roofer of the trades research: a deep
// slate-blue ground with a warm amber accent, a sturdy sans display, and real
// photography of finished roofs and homes carrying the page. Licensed and insured,
// honest upfront quotes, workmanship-and-material warranties, on-time crews. The
// functional core is BOOKING A FREE INSPECTION — homeowners book an inspection or a
// replacement estimate online and get a real time slot. Deliberately the everyday,
// photo-led, dependable sibling of the separate storm-damage / insurance-claims roofing
// template — same booking spine, a different personality.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-roofing-residential.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-roofing-residential/**" \
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
  hero: 'roofing-residential-hero',
  story: 'roofing-residential-story',
  ray: 'roofing-residential-ray',
  luis: 'roofing-residential-luis',
  dale: 'roofing-residential-dale',
} as const;

const PHOTO: Record<string, string> = {
  "summitroof-hero": "https://images.unsplash.com/photo-1587061633437-187ac80e8e7a?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8aG91c2UlMjByb29mJTIwc2hpbmdsZXN8ZW58MHwwfHx8MTc4NjM5MzcyM3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "summitroof-story": "https://images.unsplash.com/photo-1635424824849-1b09bdcc55b1?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cm9vZmVyJTIwd29ya2luZyUyMHJvb2Z8ZW58MHwwfHx8MTc4NjM5MzcyNnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "summitroof-ray": "https://images.unsplash.com/photo-1621905252507-b35492cc74b4?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y29uc3RydWN0aW9uJTIwd29ya2VyJTIwcG9ydHJhaXQlMjBtYW58ZW58MHwwfHx8MTc4NjM5MzcyOXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "summitroof-luis": "https://images.unsplash.com/photo-1507126117511-e87526de90e2?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cm9vZmVyJTIwcG9ydHJhaXR8ZW58MHwwfHx8MTc4NjM5MzczMnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "summitroof-dale": "https://images.unsplash.com/photo-1621905252507-b35492cc74b4?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y29udHJhY3RvciUyMHBvcnRyYWl0JTIwbWFufGVufDB8MHx8fDE3ODYzOTI2Mjd8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
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
    url: src('summitroof-hero'),
    alt: 'A freshly finished asphalt-shingle roof on a suburban home under a clear sky',
  },
  {
    id: IMG.story,
    url: src('summitroof-story'),
    alt: 'A roofer nailing down new shingles along a clean roof line',
  },
  { id: IMG.ray, url: src('summitroof-ray'), alt: 'Ray Sullivan, owner and lead roofer' },
  { id: IMG.luis, url: src('summitroof-luis'), alt: 'Luis Ferrara, replacement and install lead' },
  { id: IMG.dale, url: src('summitroof-dale'), alt: 'Dale Hutchins, gutter and maintenance tech' },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-roofing-residential: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "summit": slate-blue ground, amber accent, off-white light, dark slate ink ─
const summit = defineTheme({
  name: 'summit',
  type: { body: face('Inter', 'sans-serif'), head: face('Archivo', 'sans-serif') },
  shape: { selector: '0.1875rem', field: '0.1875rem', box: '0.25rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(98% 0.004 250)', // off-white ground
      'oklch(94% 0.006 250)', // cool paper
      'oklch(89% 0.01 252)', // hairline
      'oklch(24% 0.028 255)', // deep slate ink
    ],
    roles: {
      primary: 'oklch(40% 0.06 255)', // deep slate-blue
      secondary: 'oklch(35% 0.02 255)', // dark slate (readable micro-labels on light)
      accent: 'oklch(68% 0.145 58)', // warm amber / rust
      neutral: 'oklch(28% 0.02 255)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(21% 0.02 255)',
      'oklch(17% 0.018 255)',
      'oklch(13% 0.014 255)',
      'oklch(95% 0.005 250)',
    ],
    roles: {
      primary: 'oklch(72% 0.09 255)', // lifted slate-blue
      secondary: 'oklch(78% 0.02 255)',
      accent: 'oklch(76% 0.14 62)',
      neutral: 'oklch(80% 0.02 255)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the booking spine (policies, roofers + hours, the inspection menu) ────
const hours = (days: number[], startMinute: number, endMinute: number) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

const SCHEDULING = {
  policies: [
    {
      handle: 'roofing-standard',
      name: 'Standard visit',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [1440, 120],
      policyText:
        'Give us at least 24 hours’ notice to move or cancel a visit. We text a reminder the day before and confirm the arrival window when the crew is on the way.',
    },
  ],
  resources: [
    {
      handle: 'ray',
      name: 'Ray Sullivan',
      kind: 'staff',
      skillTags: ['repair', 'inspection', 'general'],
      windows: hours([1, 2, 3, 4, 5], 420, 1020), // Mon–Fri 7–5
    },
    {
      handle: 'luis',
      name: 'Luis Ferrara',
      kind: 'staff',
      skillTags: ['replacement', 'install', 'general'],
      windows: hours([1, 2, 3, 4, 5, 6], 420, 1020), // Mon–Sat 7–5
    },
    {
      handle: 'dale',
      name: 'Dale Hutchins',
      kind: 'staff',
      skillTags: ['gutters', 'maintenance', 'general'],
      windows: hours([1, 2, 3, 4, 5], 480, 990), // Mon–Fri 8–4:30
    },
  ],
  services: [
    {
      handle: 'free-inspection',
      name: 'Free roof inspection',
      description:
        'We climb up, check every slope, flashing and valley, and walk you through what we find in plain language — no charge, no pressure.',
      durationMinutes: 45,
      priceCents: 0,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'roofer', kind: 'staff', skillTags: ['general'], count: 1 },
      ],
      policyHandle: 'roofing-standard',
    },
    {
      handle: 'roof-repair-visit',
      name: 'Roof repair visit',
      description:
        'A missing shingle, a lifted flashing or a soft spot fixed right the first time, with the area left clean and watertight.',
      durationMinutes: 90,
      priceCents: 18900,
      bufferAfterMin: 15,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'roofer', kind: 'staff', skillTags: ['general'], count: 1 },
      ],
      policyHandle: 'roofing-standard',
    },
    {
      handle: 'replacement-estimate',
      name: 'Replacement estimate',
      description:
        'A full measure-up and an honest, itemized written quote to re-roof your home — materials, timeline and price, before any work is booked.',
      durationMinutes: 60,
      priceCents: 0,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'roofer', kind: 'staff', skillTags: ['general'], count: 1 },
      ],
      policyHandle: 'roofing-standard',
    },
    {
      handle: 'leak-diagnosis',
      name: 'Leak diagnosis',
      description:
        'A stain on the ceiling or a drip in the attic tracked back to its real source on the roof, with a clear fix and a firm price.',
      durationMinutes: 60,
      priceCents: 12900,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'roofer', kind: 'staff', skillTags: ['general'], count: 1 },
      ],
      policyHandle: 'roofing-standard',
    },
    {
      handle: 'gutter-service',
      name: 'Gutter cleaning & repair',
      description:
        'Gutters and downspouts cleared, resecured and tested to run — so water leaves the roof instead of sitting on it.',
      durationMinutes: 90,
      priceCents: 14900,
      bufferAfterMin: 15,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'roofer', kind: 'staff', skillTags: ['general'], count: 1 },
      ],
      policyHandle: 'roofing-standard',
    },
    {
      handle: 'maintenance-tune-up',
      name: 'Roof maintenance tune-up',
      description:
        'A yearly once-over — sealants topped up, loose shingles nailed, debris cleared — to add years to the roof you already have.',
      durationMinutes: 90,
      priceCents: 16900,
      bufferAfterMin: 15,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'roofer', kind: 'staff', skillTags: ['general'], count: 1 },
      ],
      policyHandle: 'roofing-standard',
    },
    {
      handle: 'storm-damage-assessment',
      name: 'Storm damage assessment',
      description:
        'After wind or hail, a careful top-to-bottom check with photos, so you know exactly what took a hit and what it needs.',
      durationMinutes: 120,
      priceCents: 0,
      bufferAfterMin: 15,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'roofer', kind: 'staff', skillTags: ['general'], count: 1 },
      ],
      policyHandle: 'roofing-standard',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  photoHero({
    image: url(IMG.hero),
    alt: 'A freshly finished asphalt-shingle roof on a suburban home under a clear sky',
    title: 'A roof that lasts, done right',
    sub: 'Licensed, insured and honest about what your roof actually needs. Book a free inspection online and we’ll show you exactly where it stands — no pressure, no sales pitch.',
    primary: { label: 'Book a free inspection', href: '/book' },
    secondary: { label: 'See our services', href: '/book' },
    overlay: 'dark',
  }),
  featureRow({
    items: [
      {
        title: 'Licensed & insured',
        body: 'Fully licensed, bonded and insured — our own uniformed crew on your roof, never a rotating cast of subcontractors.',
      },
      {
        title: 'Workmanship & material warranty',
        body: 'Every roof is backed in writing — the manufacturer’s material warranty plus our own workmanship guarantee on top.',
      },
      {
        title: 'Upfront, honest quotes',
        body: 'You get an itemized written price before anything starts. We tell you when a repair beats a replacement, even if it’s the smaller job.',
      },
      {
        title: 'On-time crews',
        body: 'A real arrival window and a clean, protected job site. Running behind? You hear from us first, and we haul away every scrap when we’re done.',
      },
    ],
  }),
  serviceMenu({
    heading: 'What we come out for',
    intro: 'The visits we book most. Pick one to see the price, how long it takes and the next open time — inspections and estimates are always free.',
    surface: 'muted',
    columns: 2,
    items: [
      {
        name: 'Free roof inspection',
        priceCents: 0,
        durationMin: 45,
        desc: 'A full check of every slope, valley and flashing — no charge.',
      },
      {
        name: 'Roof repair visit',
        priceCents: 18900,
        durationMin: 90,
        desc: 'A leak, lifted flashing or missing shingle fixed for good.',
      },
      {
        name: 'Replacement estimate',
        priceCents: 0,
        durationMin: 60,
        desc: 'An honest, itemized written quote to re-roof your home.',
      },
      {
        name: 'Gutter cleaning & repair',
        priceCents: 14900,
        durationMin: 90,
        desc: 'Gutters cleared, resecured and tested to run.',
      },
    ],
    cta: { label: 'See everything & book', href: '/book' },
  }),
  splitFeature({
    image: url(IMG.story),
    alt: 'A roofer nailing down new shingles along a clean roof line',
    heading: 'Built to last, and backed to prove it',
    body: [
      'We install the roof the right way — proper underlayment, sealed valleys, flashing done by hand — because the shortcuts you can’t see are the ones that leak in five years.',
      'Then we stand behind it. Every replacement carries the manufacturer’s material warranty and our own workmanship guarantee in writing, so if anything isn’t right, one call brings us back.',
    ],
    cta: { label: 'Book a free inspection', href: '/book' },
  }),
  teamRow({
    heading: 'The crew who’ll be on your roof',
    intro: 'The same familiar faces every visit — licensed, background-checked, and glad to explain what they’re doing and why.',
    members: [
      {
        name: 'Ray Sullivan',
        role: 'Owner & lead roofer',
        image: url(IMG.ray),
        alt: 'Ray Sullivan, owner and lead roofer',
        bio: 'Thirty years on roofs. Ray does the inspections, gives every quote straight, and answers the phone himself.',
      },
      {
        name: 'Luis Ferrara',
        role: 'Replacement & install lead',
        image: url(IMG.luis),
        alt: 'Luis Ferrara, replacement and install lead',
        bio: 'Full re-roofs and installs. Luis runs the crew and leaves a job site cleaner than he found it.',
      },
      {
        name: 'Dale Hutchins',
        role: 'Gutter & maintenance tech',
        image: url(IMG.dale),
        alt: 'Dale Hutchins, gutter and maintenance tech',
        bio: 'Gutters, tune-ups and the small fixes that keep a good roof going. Dale is the reason yours lasts longer.',
      },
    ],
  }),
  testimonial({
    quote: 'Two other companies told us we needed a full replacement. Ray climbed up, took photos, and showed us it was a flashing repair — a fraction of the price. That honesty is why we’ll never call anyone else.',
    attribution: 'The Delgados, Oakridge homeowners',
  }),
  bookingCta({
    title: 'Not sure what your roof needs? Let’s take a look.',
    sub: 'Book a free inspection online in about a minute. Pick a day, and we’ll confirm your arrival window.',
    cta: { label: 'Book a free inspection', href: '/book' },
  }),
];

const BOOK_INTRO = [
  photoHero({
    image: url(IMG.story),
    alt: 'A roofer nailing down new shingles along a clean roof line',
    title: 'Book your roof visit',
    sub: 'Choose the visit you need to see the price, how long it takes and the next open time — then pick your roofer and day. Inspections and estimates are always free.',
    primary: { label: 'See services below', href: '/book' },
    overlay: 'darker',
    align: 'start',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.hero),
    alt: 'A freshly finished asphalt-shingle roof on a suburban home under a clear sky',
    heading: 'About Summit Roofing',
    body: [
      'Summit Roofing started with one truck, one crew and a simple rule: tell homeowners the truth about their roof, do the work right, and stand behind it. Two decades later, that rule hasn’t changed.',
      'We’re a local, family-run roofing company serving homeowners across the area. No high-pressure sales, no scare tactics, no vanishing subcontractors — just honest quotes, quality work, and a roof that’s backed in writing.',
    ],
    cta: { label: 'Book a free inspection', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'How we work',
    items: [
      {
        title: 'An honest assessment first',
        body: 'We inspect the whole roof and show you the photos. If a repair will do, we say so — we’d rather earn the replacement when you actually need it.',
      },
      {
        title: 'Clean, protected work',
        body: 'Tarps over the landscaping, a magnet sweep for every nail, and the old material hauled away. We treat your home the way we’d want ours treated.',
      },
      {
        title: 'Guaranteed and here to stay',
        body: 'Manufacturer material warranties plus our own workmanship guarantee, all in writing — and we’re a local call away if anything ever needs a second look.',
      },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Where we work & how to reach us',
    address: ['Summit Roofing', '1804 Ridgeline Avenue', 'Cedar Falls, IA 50613'],
    mapLocation: '1804 Ridgeline Avenue, Cedar Falls, IA 50613',
    hours: [
      { day: 'Monday – Friday', time: '7:00 – 5:00' },
      { day: 'Saturday', time: '7:00 – 5:00 (estimates)' },
      { day: 'Sunday', time: 'Closed' },
      { day: 'Storm damage', time: 'Call anytime' },
    ],
  }),
  bookingCta({
    title: 'Rather book than call?',
    sub: 'See the next open times and reserve your free inspection online — no phone tag, no waiting on hold.',
    surface: 'muted',
    cta: { label: 'Book a free inspection', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-roofing-residential',
  name: 'sparx — Roofing (Residential)',
  summary:
    'A dependable residential-roofing site — a sturdy slate-blue palette with a warm amber accent and photo-led, honest reliability. Installs a working online booking flow: homeowners book a free inspection or replacement estimate and get a real time slot. Ships a full visit menu (inspection, repair, estimate, leak, gutters, maintenance, storm), three roofers as dispatchable staff with their own hours, and a standard visit policy. Ships as "Summit Roofing".',
  tagline: 'A dependable template for residential roofers — book inspections online from day one.',
  industry: 'Roofing',
  sortWeight: 30,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: {
    businessName: 'Summit Roofing',
    tagline: 'A roof that lasts, done right.',
  },
  theme: summit,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Summit Roofing — trusted residential roofers',
      description:
        'Summit Roofing is a local, family-run roofing company with honest quotes, quality work and written warranties. Book a free roof inspection or replacement estimate online.',
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
