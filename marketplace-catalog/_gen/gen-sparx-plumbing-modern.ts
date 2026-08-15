// sparx-plumbing-modern — "Rivet Plumbing Co.", a MODERN, on-demand plumbing company.
//
// The bright, techy, same-day plumber: transparent flat-rate pricing, book online in
// under a minute, a texted arrival window and live-tech-tracking confidence. Type-led,
// steps-forward, deliberately LESS photo-heavy — a vivid teal primary over a crisp
// near-white ground with a warm amber accent and a dark-slate secondary.
//
// This is the "modern / on-demand" sibling of the plumbing family. The OTHER plumbing
// template is the warm, established, photo-led navy-and-brass shop; this one must read
// visibly different: brighter palette, a `typeHero` instead of a photo hero, a
// "how it works" three-step structure, and confidence carried by TYPE, not imagery.
// Same booking spine — a live `scheduling.services` core makes /book FUNCTION on day one.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-plumbing-modern.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-plumbing-modern/**" \
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
  pricing: 'plumbing-modern-pricing',
  team: 'plumbing-modern-team',
  marcus: 'plumbing-modern-marcus',
  dwayne: 'plumbing-modern-dwayne',
  sofia: 'plumbing-modern-sofia',
} as const;

const PHOTO: Record<string, string> = {
  "rivet-pricing": "https://images.unsplash.com/photo-1454988501794-2992f706932e?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGx1bWJpbmclMjB0b29scyUyMG1vZGVybnxlbnwwfDB8fHwxNzg2Mzg4MjI4fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "rivet-team": "https://images.unsplash.com/photo-1587813369290-091c9d432daf?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c2VydmljZSUyMHZhbiUyMHdvcmt8ZW58MHwwfHx8MTc4NjM4ODIzMXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "rivet-dwayne": "https://images.unsplash.com/photo-1530983822321-fcac2d3c0f06?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29ya2VyJTIwcG9ydHJhaXQlMjBtYW58ZW58MHwwfHx8MTc4NjM4ODIzNnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "rivet-sofia": "https://images.unsplash.com/photo-1615464670798-6e92fafa2a89?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjB3b3JrZXIlMjBwb3J0cmFpdHxlbnwwfDB8fHwxNzg2Mzg4MjQwfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "rivet-marcus": "https://images.unsplash.com/photo-1600180758890-6b94519a8ba6?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bWFuJTIwcG9ydHJhaXQlMjBoZWFkc2hvdCUyMGNhc3VhbHxlbnwwfDB8fHwxNzg2Mzg4MzQ3fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
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
    id: IMG.pricing,
    url: src('rivet-pricing'),
    alt: 'A plumber showing a homeowner the flat-rate price on a tablet before starting work',
  },
  {
    id: IMG.team,
    url: src('rivet-team'),
    alt: 'A Rivet Plumbing service van and two uniformed technicians ready for the day',
  },
  {
    id: IMG.marcus,
    url: src('rivet-marcus'),
    alt: 'Marcus Vale, service plumber',
  },
  {
    id: IMG.dwayne,
    url: src('rivet-dwayne'),
    alt: 'Dwayne Ellis, water-heater and gas specialist',
  },
  {
    id: IMG.sofia,
    url: src('rivet-sofia'),
    alt: 'Sofia Reyes, emergency and remodel lead',
  },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-plumbing-modern: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "rivet": crisp near-white ground, vivid teal primary, amber accent, slate ink ─
const rivet = defineTheme({
  name: 'rivet',
  type: { body: face('Inter', 'sans-serif'), head: face('Space Grotesk', 'sans-serif') },
  shape: { selector: '0.5rem', field: '0.5rem', box: '0.75rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(98.5% 0.004 220)', // crisp near-white
      'oklch(96% 0.007 216)', // cool paper
      'oklch(91% 0.011 214)', // hairline
      'oklch(27% 0.03 240)', // dark slate ink
    ],
    roles: {
      primary: 'oklch(62% 0.125 205)', // vivid teal
      secondary: 'oklch(38% 0.032 242)', // dark slate — micro-labels stay legible on light
      accent: 'oklch(72% 0.155 58)', // warm amber
      neutral: 'oklch(30% 0.022 240)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(22% 0.022 242)',
      'oklch(18% 0.02 242)',
      'oklch(14% 0.016 242)',
      'oklch(96% 0.005 220)',
    ],
    roles: {
      primary: 'oklch(72% 0.13 202)',
      secondary: 'oklch(78% 0.022 230)',
      accent: 'oklch(78% 0.15 60)',
      neutral: 'oklch(83% 0.022 230)',
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
      handle: 'standard-visit',
      name: 'Standard visit',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [1440, 120],
      policyText:
        'Booked a standard visit? We’ll text your arrival window the morning of, then a heads-up when your tech is on the way. Reschedule free with 24 hours’ notice.',
    },
    {
      handle: 'same-day-priority',
      name: 'Same-day priority',
      depositType: 'none',
      cancellationWindowHours: 4,
      reminderOffsetsMin: [240, 60],
      policyText:
        'Same-day and emergency visits are dispatched to the next available tech. We text a tighter arrival window and call before we roll. Please give us 4 hours’ notice to release the slot.',
    },
  ],
  resources: [
    {
      handle: 'marcus',
      name: 'Marcus Vale',
      kind: 'staff',
      skillTags: ['repair', 'drain', 'install'],
      windows: hours([1, 2, 3, 4, 5, 6], 420, 1140), // Mon–Sat 7–7
    },
    {
      handle: 'dwayne',
      name: 'Dwayne Ellis',
      kind: 'staff',
      skillTags: ['repair', 'water-heater', 'gas'],
      windows: hours([1, 2, 3, 4, 5, 0], 420, 1200), // Mon–Fri + Sun 7–8
    },
    {
      handle: 'sofia',
      name: 'Sofia Reyes',
      kind: 'staff',
      skillTags: ['emergency', 'repair', 'remodel'],
      windows: hours([2, 3, 4, 5, 6, 0], 480, 1260), // Tue–Sat + Sun 8–9
    },
  ],
  services: [
    {
      handle: 'free-quote',
      name: 'Free in-home quote',
      description:
        'We come out, look at the job and hand you a flat-rate price in writing — no charge, no obligation.',
      durationMinutes: 30,
      priceCents: 0,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'tech', kind: 'staff', skillTags: ['repair'], count: 1 }],
      policyHandle: 'standard-visit',
    },
    {
      handle: 'same-day-repair',
      name: 'Same-day repair visit',
      description:
        'The everyday fix — a running toilet, a dripping valve, a fixture that quit. Priced flat before we start.',
      durationMinutes: 60,
      priceCents: 14900,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'tech', kind: 'staff', skillTags: ['repair'], count: 1 }],
      policyHandle: 'same-day-priority',
    },
    {
      handle: 'drain-clear',
      name: 'Drain clearing',
      description:
        'A slow or backed-up sink, tub or main line, cleared and tested — one flat price whether it takes ten minutes or an hour.',
      durationMinutes: 75,
      priceCents: 19900,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'tech', kind: 'staff', skillTags: ['drain'], count: 1 }],
      policyHandle: 'same-day-priority',
    },
    {
      handle: 'water-heater-swap',
      name: 'Water-heater replacement',
      description:
        'Out with the old, in with a new tank or tankless — haul-away, hookup and a working hot shower the same day.',
      durationMinutes: 120,
      priceCents: 189900,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'tech', kind: 'staff', skillTags: ['water-heater'], count: 1 },
      ],
      policyHandle: 'standard-visit',
    },
    {
      handle: 'toilet-faucet-install',
      name: 'Toilet or faucet install',
      description:
        'You bought the fixture, we set it right — clean install, no leaks, old one hauled away. Flat labor price.',
      durationMinutes: 90,
      priceCents: 24900,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'tech', kind: 'staff', skillTags: ['install'], count: 1 }],
      policyHandle: 'standard-visit',
    },
    {
      handle: 'leak-detection',
      name: 'Leak detection',
      description:
        'A mystery drip, a spiking water bill, a damp wall — we find the source and give you the fix and the price in one visit.',
      durationMinutes: 60,
      priceCents: 12900,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'tech', kind: 'staff', skillTags: ['repair'], count: 1 }],
      policyHandle: 'standard-visit',
    },
    {
      handle: 'emergency-callout',
      name: 'Emergency callout',
      description:
        'Burst pipe, no water, water where it shouldn’t be. We confirm a tech, text a tight window and roll fast.',
      durationMinutes: 90,
      priceCents: 29900,
      requiresApproval: true,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'tech', kind: 'staff', skillTags: ['emergency'], count: 1 }],
      policyHandle: 'same-day-priority',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  typeHero({
    title: 'A plumber today. A price up front. Zero surprises.',
    sub: 'Rivet is the on-demand way to fix what’s leaking, clogged or broken — book online in about a minute, get a texted arrival window, and pay a flat rate you see before we start.',
    primary: { label: 'Book in 60 seconds', href: '/book' },
    secondary: { label: 'See flat-rate prices', href: '/book' },
    surface: 'base',
  }),
  featureRow({
    heading: 'How it works',
    items: [
      {
        title: 'Book online in a minute',
        body: 'Pick what’s wrong and a time that works. No phone tree, no waiting on hold, no “someone will call you back.”',
      },
      {
        title: 'We text your arrival window',
        body: 'You get a real window and a heads-up when your tech is on the way — so you’re not stuck home all day guessing.',
      },
      {
        title: 'Flat-rate fix, same day',
        body: 'Your tech prices the job before touching a tool. You approve it, they fix it, you get on with your day.',
      },
    ],
  }),
  serviceMenu({
    heading: 'Flat-rate visits',
    intro: 'Real prices, in writing, before any work starts. Book any of these online and see live availability.',
    surface: 'muted',
    columns: 2,
    items: [
      {
        name: 'Free in-home quote',
        priceCents: 0,
        durationMin: 30,
        desc: 'We look at the job and hand you a written price — no charge.',
      },
      {
        name: 'Same-day repair visit',
        priceCents: 14900,
        durationMin: 60,
        desc: 'The everyday fix, priced flat before we start.',
      },
      {
        name: 'Drain clearing',
        priceCents: 19900,
        durationMin: 75,
        desc: 'Cleared and tested — one price, however long it takes.',
      },
      {
        name: 'Water-heater replacement',
        priceCents: 189900,
        durationMin: 120,
        desc: 'New tank or tankless, installed and hauled away same day.',
      },
    ],
    cta: { label: 'See every service & book', href: '/book' },
  }),
  splitFeature({
    image: url(IMG.pricing),
    alt: 'A plumber showing a homeowner the flat-rate price on a tablet before starting work',
    heading: 'The price you’re quoted is the price you pay',
    body: [
      'No hourly meter running while you watch. No “well, it turned out to be bigger than we thought.” Your tech diagnoses the job, shows you a flat rate on the spot, and nothing changes once you say go.',
      'It’s the whole reason we built Rivet: plumbing you can actually plan around, from a company that tells you the number before it picks up a wrench.',
    ],
    cta: { label: 'Get your flat rate', href: '/book' },
  }),
  teamRow({
    heading: 'The techs we’ll send',
    intro: 'Licensed, background-checked and in uniform. You’ll know who’s coming before they knock.',
    members: [
      {
        name: 'Marcus Vale',
        role: 'Service plumber',
        image: url(IMG.marcus),
        alt: 'Marcus Vale, service plumber',
        bio: 'Repairs, drains and fixture installs. Fast, tidy, and explains what he’s doing.',
      },
      {
        name: 'Dwayne Ellis',
        role: 'Water-heater & gas specialist',
        image: url(IMG.dwayne),
        alt: 'Dwayne Ellis, water-heater and gas specialist',
        bio: 'Tank and tankless swaps, gas lines and the tricky hookups. Certified, unflappable.',
      },
      {
        name: 'Sofia Reyes',
        role: 'Emergency & remodel lead',
        image: url(IMG.sofia),
        alt: 'Sofia Reyes, emergency and remodel lead',
        bio: 'Burst pipes at 2am and full-bath remodels alike. The one you want when it’s serious.',
      },
    ],
  }),
  testimonial({
    quote: 'Booked at 8am, had a window by 9, and Marcus was done before lunch — for exactly the price the app showed me. First plumber I haven’t had to argue with about the bill.',
    attribution: 'Renée T., homeowner in Eastside',
  }),
  bookingCta({
    title: 'Something leaking right now?',
    sub: 'Book a visit online and see live times. Emergencies get the next available tech.',
    cta: { label: 'Book a visit', href: '/book' },
  }),
];

const BOOK_INTRO = [
  typeHero({
    title: 'Book your visit',
    sub: 'Pick what’s going on to see the flat rate and live availability, then choose a time. We’ll text your arrival window and confirm your tech.',
    primary: { label: 'Choose a service below', href: '/book' },
    surface: 'primary',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.team),
    alt: 'A Rivet Plumbing service van and two uniformed technicians ready for the day',
    heading: 'Plumbing, brought up to date',
    body: [
      'Rivet Plumbing Co. started with a simple frustration: why is booking a plumber still a phone call, a four-hour window, and a bill that lands higher than the quote? So we rebuilt the whole thing around the customer.',
      'Book online. Get a real window. See the flat price before work starts. Track your tech to the door. Same trucks, same licensed people you’d want anyway — just none of the runaround.',
    ],
    cta: { label: 'Book a visit', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'What you can count on',
    items: [
      {
        title: 'Upfront flat pricing',
        body: 'You approve a written price before we start. It doesn’t move — no hourly clock, no surprise line items.',
      },
      {
        title: 'Same-day when you need it',
        body: 'Longer hours and weekend coverage mean “today” is usually a real answer, not a hopeful one.',
      },
      {
        title: 'Licensed & guaranteed',
        body: 'Every tech is licensed, insured and background-checked, and every repair is backed by our workmanship guarantee.',
      },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Reach the shop',
    address: ['Rivet Plumbing Co.', '4120 Harbor Industrial Way', 'Bay 6 · Tacoma, WA 98421'],
    mapLocation: '4120 Harbor Industrial Way, Tacoma, WA 98421',
    hours: [
      { day: 'Monday – Friday', time: '7:00 – 8:00' },
      { day: 'Saturday', time: '8:00 – 6:00' },
      { day: 'Sunday', time: '8:00 – 4:00 (same-day & emergencies)' },
      { day: 'Emergencies', time: 'Dispatched around the clock' },
    ],
  }),
  bookingCta({
    title: 'Skip the phone tag',
    sub: 'Booking online is faster than calling — see live times and lock in your visit in about a minute.',
    surface: 'muted',
    cta: { label: 'Book online', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-plumbing-modern',
  name: 'Plumbing (Modern)',
  summary:
    'A modern, on-demand plumbing site — a crisp near-white palette with a vivid teal primary and warm amber accent, type-led with a "how it works" flow. Installs a working booking spine: flat-rate visits (same-day repair, drain clearing, water-heater swap, leak detection, emergency callout), three technicians dispatched by skill with their own weekly hours, and a same-day priority policy. Ships as "Rivet Plumbing Co.".',
  tagline: 'A bright, modern template for on-demand plumbers — book online from day one.',
  industry: 'Plumbing',
  sortWeight: 77,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'Rivet Plumbing Co.', tagline: 'Same-day plumbing, flat-rate pricing.' },
  theme: rivet,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Rivet Plumbing Co. — same-day plumbing, flat-rate pricing',
      description:
        'Book a licensed plumber online in about a minute. Flat-rate prices up front, a texted arrival window, and same-day repairs, drains, water heaters and emergencies.',
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
