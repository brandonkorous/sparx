// sparx-dayspa-nordic — "Kald", a cool, mineral Nordic DAY SPA & bathhouse.
//
// The glacial hydrotherapy lane of the design research (Blue Lagoon / geothermal
// bathhouse): a milky glacial off-white ground, a volcanic-charcoal ink, a mineral
// blue-teal primary and a pale silica/sky accent, with a clean minimal sans and quiet,
// elemental photography. Deliberately the OPPOSITE of the warm botanical day spa (oat,
// terracotta, plants) — this is cool, spare, expansive: water, stone, steam and cold air.
// Same booking spine, a different business.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @wizeworks/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-dayspa-nordic.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-dayspa-nordic/**" \
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
  galleryStrip,
  photoHero,
  serviceMenu,
  splitFeature,
  STATUS_ON_DARK,
  STATUS_ON_LIGHT,
  teamRow,
  typeHero,
  type ServiceSiteSpec,
} from './service-sites/harness';

// ── Imagery (swap-ready; each id also names an entry in ASSETS) ────────────────────
const IMG = {
  hero: 'dayspa-nordic-hero',
  pool: 'dayspa-nordic-pool',
  sauna: 'dayspa-nordic-sauna',
  plunge: 'dayspa-nordic-plunge',
  ritual: 'dayspa-nordic-ritual',
  eir: 'dayspa-nordic-eir',
  astrid: 'dayspa-nordic-astrid',
  kai: 'dayspa-nordic-kai',
} as const;

const PHOTO: Record<string, string> = {
  "kald-hero": "https://images.unsplash.com/photo-1519320993082-43a535317ddc?w=1600&q=80",
  "kald-pool": "https://images.unsplash.com/photo-1532691403316-d08a19730ed9?w=1600&q=80",
  "kald-sauna": "https://images.unsplash.com/photo-1757940556610-a114be4733bf?w=1600&q=80",
  "kald-plunge": "https://images.unsplash.com/photo-1719746293616-b11f06e63078?w=1600&q=80",
  "kald-ritual": "https://images.unsplash.com/photo-1654183305001-62d2fdbd18f0?w=1600&q=80",
  "kald-eir": "https://images.unsplash.com/photo-1769011496342-2bd1ad232d8f?w=1600&q=80",
  "kald-astrid": "https://images.unsplash.com/photo-1759216853033-6f0ae58b690a?w=1600&q=80",
  "kald-kai": "https://images.unsplash.com/photo-1759216852567-5e1dd25f79f6?w=1600&q=80",
};
const src = (seed: string): string =>
  PHOTO[seed] ?? `https://picsum.photos/seed/${seed}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}
const ASSETS: Asset[] = [
  { id: IMG.hero, url: src('kald-hero'), alt: 'Still mineral water under a pale, quiet sky' },
  { id: IMG.pool, url: src('kald-pool'), alt: 'A steaming geothermal soaking pool at first light' },
  { id: IMG.sauna, url: src('kald-sauna'), alt: 'A spare timber sauna lit by a low window' },
  { id: IMG.plunge, url: src('kald-plunge'), alt: 'A cold plunge basin cut from pale stone' },
  { id: IMG.ritual, url: src('kald-ritual'), alt: 'Warm and cold water meeting over smooth rock' },
  { id: IMG.eir, url: src('kald-eir'), alt: 'Eir Halvorsen, lead therapist' },
  { id: IMG.astrid, url: src('kald-astrid'), alt: 'Astrid Lund, massage therapist' },
  { id: IMG.kai, url: src('kald-kai'), alt: 'Kai Sørensen, therapist' },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-dayspa-nordic: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "kald": glacial off-white ground, volcanic-charcoal ink, mineral blue-teal ──
const kald = defineTheme({
  name: 'kald',
  type: { body: face('Inter', 'sans-serif'), head: face('Archivo', 'sans-serif') },
  shape: { selector: '0.375rem', field: '0.375rem', box: '0.375rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(97% 0.006 220)', // milky glacial off-white
      'oklch(94% 0.008 218)', // pale mist
      'oklch(89% 0.01 214)', // hairline
      'oklch(24% 0.012 250)', // volcanic charcoal ink
    ],
    roles: {
      primary: 'oklch(55% 0.06 220)', // mineral blue-teal
      secondary: 'oklch(42% 0.02 240)', // cool slate
      accent: 'oklch(80% 0.045 210)', // pale silica / sky
      neutral: 'oklch(28% 0.01 240)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(22% 0.012 250)',
      'oklch(18% 0.01 250)',
      'oklch(14% 0.008 250)',
      'oklch(94% 0.006 220)',
    ],
    roles: {
      primary: 'oklch(68% 0.07 215)',
      secondary: 'oklch(72% 0.02 230)',
      accent: 'oklch(78% 0.05 205)',
      neutral: 'oklch(82% 0.01 235)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the booking spine (policies, therapists + pools/rooms, the menu) ──────
const hours = (days: number[], startMinute: number, endMinute: number) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

const SCHEDULING = {
  policies: [
    {
      handle: 'kald-standard',
      name: 'Standard booking',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [1440, 120],
      policyText:
        'Please give us at least 24 hours’ notice to change or cancel. We send a reminder the day before and two hours ahead. Arrive ten minutes early to settle in.',
    },
    {
      handle: 'bathhouse-deposit',
      name: 'Private bathhouse deposit',
      depositType: 'deposit',
      depositAmountCents: 5000,
      cancellationWindowHours: 48,
      reminderOffsetsMin: [2880, 1440, 120],
      policyText:
        'The private bathhouse holds a $50 deposit that comes off your total. Reschedule with 48 hours’ notice and it carries over to your next visit.',
    },
  ],
  resources: [
    // Therapists (staff) — booked by name for hands-on treatments.
    {
      handle: 'eir',
      name: 'Eir Halvorsen',
      kind: 'staff',
      skillTags: ['massage', 'facial', 'body'],
      windows: hours([2, 3, 4, 5, 6], 540, 1020), // Tue–Sat 9–5
    },
    {
      handle: 'astrid',
      name: 'Astrid Lund',
      kind: 'staff',
      skillTags: ['massage', 'body', 'facial'],
      windows: hours([3, 4, 5, 6, 0], 660, 1140), // Wed–Sun 11–7
    },
    {
      handle: 'kai',
      name: 'Kai Sørensen',
      kind: 'staff',
      skillTags: ['massage', 'facial'],
      windows: hours([2, 4, 5, 6], 600, 1080), // Tue, Thu–Sat 10–6
    },
    // Pools & rooms (spaces) — the three elemental resources a booking consumes.
    {
      handle: 'thermal-pool',
      name: 'Thermal soaking pool',
      kind: 'space',
      skillTags: ['thermal', 'soak'],
      capacity: 12,
      windows: hours([2, 3, 4, 5, 6, 0], 480, 1260), // Tue–Sun 8–9
    },
    {
      handle: 'sauna-circuit',
      name: 'Sauna & cold-plunge circuit',
      kind: 'space',
      skillTags: ['sauna', 'plunge'],
      capacity: 8,
      windows: hours([2, 3, 4, 5, 6, 0], 480, 1260), // Tue–Sun 8–9
    },
    {
      handle: 'treatment-room',
      name: 'Treatment room',
      kind: 'space',
      skillTags: ['treatment', 'massage', 'facial', 'body'],
      capacity: 3, // three quiet rooms, pooled
      windows: hours([2, 3, 4, 5, 6, 0], 540, 1200), // Tue–Sun 9–8
    },
  ],
  services: [
    {
      handle: 'thermal-soak',
      name: 'Thermal soak session',
      description:
        'An unhurried hour in the mineral-warm soaking pool. Come as you are — no treatment, no schedule, just warm water and quiet.',
      bookingType: 'reservation',
      durationMinutes: 90,
      priceCents: 4500,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'pool', kind: 'space', skillTags: ['thermal'], count: 1 },
      ],
      policyHandle: 'kald-standard',
    },
    {
      handle: 'sauna-plunge-circuit',
      name: 'Sauna & cold-plunge circuit',
      description:
        'The full hot-and-cold ritual — dry sauna, cold plunge, rest, repeat. A guided first round if it’s new to you.',
      bookingType: 'reservation',
      durationMinutes: 75,
      priceCents: 4000,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'circuit', kind: 'space', skillTags: ['sauna'], count: 1 },
      ],
      policyHandle: 'kald-standard',
    },
    {
      handle: 'massage-60',
      name: 'Massage — 60 minutes',
      description: 'A calm, pressure-to-taste massage in a still room. Book a therapist by name.',
      durationMinutes: 60,
      priceCents: 12000,
      bufferAfterMin: 15,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'therapist', kind: 'staff', skillTags: ['massage'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['treatment'], count: 1 },
      ],
      policyHandle: 'kald-standard',
    },
    {
      handle: 'massage-90',
      name: 'Massage — 90 minutes',
      description: 'The longer session — full-body, unrushed, with time to actually let go.',
      durationMinutes: 90,
      priceCents: 16500,
      bufferAfterMin: 15,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'therapist', kind: 'staff', skillTags: ['massage'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['treatment'], count: 1 },
      ],
      policyHandle: 'kald-standard',
    },
    {
      handle: 'mineral-facial',
      name: 'Mineral facial',
      description:
        'A clean, mineral-rich facial — cleanse, a warm-and-cool contrast, and a light finish. Nothing fussy.',
      durationMinutes: 60,
      priceCents: 13500,
      bufferAfterMin: 10,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'therapist', kind: 'staff', skillTags: ['facial'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['treatment'], count: 1 },
      ],
      policyHandle: 'kald-standard',
    },
    {
      handle: 'body-treatment',
      name: 'Mineral body treatment',
      description:
        'A full-body salt scrub and mineral wrap that leaves skin soft and the mind somewhere quieter.',
      durationMinutes: 75,
      priceCents: 15000,
      bufferAfterMin: 15,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'therapist', kind: 'staff', skillTags: ['body'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['treatment'], count: 1 },
      ],
      policyHandle: 'kald-standard',
    },
    {
      handle: 'private-bathhouse',
      name: 'Private bathhouse hour',
      description:
        'The whole bathhouse to yourselves — pool, sauna and plunge, for up to eight. An hour that belongs to no one else.',
      bookingType: 'reservation',
      durationMinutes: 60,
      priceCents: 22000,
      capacity: 8,
      bufferAfterMin: 30,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'pool', kind: 'space', skillTags: ['thermal'], count: 1 },
      ],
      policyHandle: 'bathhouse-deposit',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  typeHero({
    title: 'Warm water. Cold air. A quieter you.',
    sub: 'Kald is a mineral bathhouse and day spa — a spare, elemental place to soak, sweat, plunge and slow all the way down. Book an hour that’s genuinely yours.',
    primary: { label: 'Book online', href: '/book' },
    secondary: { label: 'See the menu', href: '/book' },
    surface: 'base',
  }),
  galleryStrip({
    heading: 'The space',
    surface: 'muted',
    columns: 3,
    images: [
      { src: url(IMG.pool), alt: 'A steaming geothermal soaking pool at first light' },
      { src: url(IMG.sauna), alt: 'A spare timber sauna lit by a low window' },
      { src: url(IMG.plunge), alt: 'A cold plunge basin cut from pale stone' },
    ],
  }),
  serviceMenu({
    heading: 'The menu',
    intro: 'A few of the ways in. Full prices and live availability are on the booking page.',
    columns: 2,
    items: [
      {
        name: 'Thermal soak session',
        priceCents: 4500,
        durationMin: 90,
        desc: 'An unhurried hour in the mineral-warm pool.',
      },
      {
        name: 'Sauna & cold-plunge circuit',
        priceCents: 4000,
        durationMin: 75,
        desc: 'The full hot-and-cold ritual, guided if it’s new.',
      },
      {
        name: 'Massage — 60 minutes',
        priceCents: 12000,
        durationMin: 60,
        desc: 'A calm, pressure-to-taste massage in a still room.',
      },
      {
        name: 'Private bathhouse hour',
        priceCents: 22000,
        durationMin: 60,
        desc: 'The whole bathhouse to yourselves, up to eight.',
      },
    ],
    cta: { label: 'See everything & book', href: '/book' },
  }),
  splitFeature({
    image: url(IMG.ritual),
    alt: 'Warm and cold water meeting over smooth rock',
    heading: 'The ritual is the point',
    body: [
      'Warm, then cold, then rest — again. It’s an old idea and a simple one: the contrast is what settles the body and clears the head. There’s nothing to master, and no wrong way to do it.',
      'We keep the rooms quiet and the day unhurried, so an hour here feels like a proper reset rather than an appointment to get through.',
    ],
    cta: { label: 'Book your hour', href: '/book' },
  }),
  featureRow({
    items: [
      {
        title: 'Water, stone and steam',
        body: 'A geothermal soaking pool, a timber sauna and a cold plunge — the whole elemental circuit, kept spotless and calm.',
      },
      {
        title: 'Unhurried by design',
        body: 'We limit how many soak at once, so it never feels crowded. Your hour is yours, with room to breathe.',
      },
      {
        title: 'Hands that know the work',
        body: 'Massage, mineral facials and body treatments from therapists you book by name — quiet, skilled, unrushed.',
      },
    ],
  }),
  teamRow({
    heading: 'Who you’ll be in hands with',
    intro: 'Book a therapist by name — you’ll see the same person each visit.',
    members: [
      {
        name: 'Eir Halvorsen',
        role: 'Lead therapist',
        image: url(IMG.eir),
        alt: 'Eir Halvorsen, lead therapist',
        bio: 'Deep, considered massage and mineral facials. Eir shapes the treatment menu.',
      },
      {
        name: 'Astrid Lund',
        role: 'Massage therapist',
        image: url(IMG.astrid),
        alt: 'Astrid Lund, massage therapist',
        bio: 'Slow, full-body work and the mineral body treatment.',
      },
      {
        name: 'Kai Sørensen',
        role: 'Therapist',
        image: url(IMG.kai),
        alt: 'Kai Sørensen, therapist',
        bio: 'Restorative massage and facials, with an easy, quiet manner.',
      },
    ],
  }),
  bookingCta({
    title: 'The water’s warm',
    sub: 'Pick a session, choose a time and see live availability. It takes about a minute.',
    cta: { label: 'Book online', href: '/book' },
  }),
];

const BOOK_INTRO = [
  photoHero({
    image: url(IMG.pool),
    alt: 'A steaming geothermal soaking pool at first light',
    title: 'Book your session',
    sub: 'Choose a session to see prices and live availability, then pick your time — or your therapist.',
    primary: { label: 'See sessions below', href: '/book' },
    overlay: 'darker',
    align: 'start',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.hero),
    alt: 'Still mineral water under a pale, quiet sky',
    heading: 'About Kald',
    body: [
      'We built Kald around one thing: warm water, cold air, and the quiet in between. No noise, no upsell, no rush — just the old ritual of soaking and plunging, done well.',
      'It’s a spare, elemental place on purpose. Fewer people in the water, more room to breathe, and an hour that feels like it actually belongs to you.',
    ],
    cta: { label: 'Book a session', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'How a visit works',
    items: [
      {
        title: 'Arrive and settle',
        body: 'Come ten minutes early. We’ll show you the circuit and let you set your own pace — warm, cold, rest, repeat.',
      },
      {
        title: 'Soak, sweat, plunge',
        body: 'Move between the pool, the sauna and the plunge as often as you like. There’s no schedule to keep.',
      },
      {
        title: 'Add hands if you like',
        body: 'A massage, a mineral facial or a body treatment turns an hour into an afternoon. Book it alongside your soak.',
      },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Visit the bathhouse',
    address: ['Kald', '9 Fjordline Way', 'Portland, OR 97209'],
    mapLocation: '9 Fjordline Way, Portland, OR 97209',
    hours: [
      { day: 'Tuesday – Friday', time: '8:00 – 9:00' },
      { day: 'Saturday', time: '8:00 – 9:00' },
      { day: 'Sunday', time: '8:00 – 9:00' },
      { day: 'Monday', time: 'Closed' },
    ],
  }),
  bookingCta({
    title: 'Rather book than call?',
    sub: 'See live availability and reserve your session online — no phone tag.',
    surface: 'muted',
    cta: { label: 'Book online', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-dayspa-nordic',
  name: 'Day Spa (Nordic)',
  summary:
    'A cool, mineral day spa and bathhouse site — a glacial off-white palette, a blue-teal primary and a clean minimal sans, with quiet, elemental photography. Installs a working booking flow: thermal soak sessions, a sauna and cold-plunge circuit, 60/90-minute massage, a mineral facial and body treatment, plus a private bathhouse hour with a deposit. Three therapists and three pools and rooms carry real hours. Ships as “Kald”.',
  tagline: 'A calm, mineral template for day spas and bathhouses — book online from day one.',
  industry: 'Day spa',
  sortWeight: 79,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'Kald', tagline: 'Warm water, cold air, a quieter you.' },
  theme: kald,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Kald — a Nordic day spa & bathhouse',
      description:
        'Kald is a mineral bathhouse and day spa for thermal soaks, a sauna and cold-plunge circuit, massage and facials. Book your session online.',
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
