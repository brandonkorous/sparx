// sparx-auto-euro — "Autobahn Werks", a specialist EUROPEAN-IMPORT auto shop.
//
// The precision/premium sibling of the auto family: BMW · Mercedes · Audi · Porsche · VW,
// factory-trained, dealer-level diagnostics, performance-minded. Deliberately the OPPOSITE
// of the warm neighborhood-shop auto template — a dark graphite ground, a sharp marque-red
// primary, a precise modern sans display, tight radii, and a confident/technical voice.
// Same booking spine as the rest of the service family, a very different business: master
// technicians AND service bays as bookable resources, so a real visit needs BOTH.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-auto-euro.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-auto-euro/**" \
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
  teamRow,
  testimonial,
  type ServiceSiteSpec,
} from './service-sites/harness';

// ── Imagery (swap-ready; each id also names an entry in ASSETS) ────────────────────
const IMG = {
  hero: 'auto-euro-hero',
  bay: 'auto-euro-bay',
  diag: 'auto-euro-diag',
  klaus: 'auto-euro-klaus',
  dieter: 'auto-euro-dieter',
  lena: 'auto-euro-lena',
} as const;

// EMPTY on purpose — every image falls through to a deterministic picsum seed prefixed
// `autobahn-`, so the bundle ships without hot-linking a stranger's photo. Drop real URLs
// in here keyed by seed to art-direct without touching the tree.
const PHOTO: Record<string, string> = {
  "autobahn-hero": "https://images.unsplash.com/photo-1527383418406-f85a3b146499?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bHV4dXJ5JTIwY2FyJTIwZW5naW5lfGVufDB8MHx8fDE3ODYzODkyNjh8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "autobahn-bay": "https://images.unsplash.com/photo-1676018366904-c083ed678e60?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2FyJTIwd29ya3Nob3AlMjBnYXJhZ2V8ZW58MHwwfHx8MTc4NjM4OTI3MXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "autobahn-diag": "https://images.unsplash.com/photo-1727893372771-b4ccae9b9f0b?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2FyJTIwZGlhZ25vc3RpYyUyMGNvbXB1dGVyfGVufDB8MHx8fDE3ODYzODkyNzR8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "autobahn-klaus": "https://images.unsplash.com/photo-1532601026355-709a58040664?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bWVjaGFuaWMlMjBwb3J0cmFpdCUyMG1hbnxlbnwwfDB8fHwxNzg2Mzg5MjU5fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "autobahn-dieter": "https://images.unsplash.com/photo-1715029005043-e88d219a3c48?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZW5naW5lZXIlMjBwb3J0cmFpdCUyMG1hbnxlbnwwfDB8fHwxNzg2Mzg5Mjc5fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "autobahn-lena": "https://images.unsplash.com/photo-1506863530036-1efeddceb993?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjBwb3J0cmFpdCUyMHByb2Zlc3Npb25hbCUyMGhlYWRzaG90fGVufDB8MHx8fDE3ODYzODkzNjV8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (seed: string): string =>
  PHOTO[seed] ?? `https://picsum.photos/seed/${seed}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}
const ASSETS: Asset[] = [
  { id: IMG.hero, url: src('autobahn-hero'), alt: 'A European performance sedan in a clean service bay under focused light' },
  { id: IMG.bay, url: src('autobahn-bay'), alt: 'A precise, orderly workshop with a car on a lift' },
  { id: IMG.diag, url: src('autobahn-diag'), alt: 'A technician running a factory-level diagnostic scan on a laptop' },
  { id: IMG.klaus, url: src('autobahn-klaus'), alt: 'Klaus Adler, master diagnostic technician' },
  { id: IMG.dieter, url: src('autobahn-dieter'), alt: 'Dieter Voss, master service technician' },
  { id: IMG.lena, url: src('autobahn-lena'), alt: 'Lena Brandt, master inspection technician' },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-auto-euro: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "autobahn": graphite ground, marque-red primary, steel-blue accent ─────
// Dark in BOTH modes (like the barber-heritage template): a near-black graphite chassis
// reads premium and technical, and stays consistent whether the visitor's OS is light or
// dark. `secondary` is a LIGHT ink so the kit's `text-secondary` micro-labels (durations,
// roles) pass contrast on the dark ground; both blocks spread STATUS_ON_DARK.
const autobahn = defineTheme({
  name: 'autobahn',
  type: { body: face('Inter', 'sans-serif'), head: face('Space Grotesk', 'sans-serif') },
  shape: { selector: '0.25rem', field: '0.25rem', box: '0.375rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(22% 0.012 250)', // graphite ground
      'oklch(26% 0.014 250)', // raised panel
      'oklch(32% 0.016 250)', // hairline / border
      'oklch(95% 0.005 250)', // near-white ink
    ],
    roles: {
      primary: 'oklch(58% 0.204 25)', // sharp marque red
      secondary: 'oklch(82% 0.01 250)', // light steel ink (readable micro-labels)
      accent: 'oklch(70% 0.12 240)', // cool steel-blue
      neutral: 'oklch(30% 0.012 250)',
      ...STATUS_ON_DARK,
    },
  },
  dark: {
    surfaces: [
      'oklch(17% 0.01 250)',
      'oklch(21% 0.012 250)',
      'oklch(27% 0.014 250)',
      'oklch(96% 0.005 250)',
    ],
    roles: {
      primary: 'oklch(62% 0.212 25)',
      secondary: 'oklch(84% 0.01 250)',
      accent: 'oklch(74% 0.12 240)',
      neutral: 'oklch(34% 0.012 250)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the booking spine (policies, technicians + bays, the visit menu) ──────
const hours = (days: number[], startMinute: number, endMinute: number) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

const SCHEDULING = {
  policies: [
    {
      handle: 'shop-standard',
      name: 'Standard booking',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [1440, 120],
      policyText:
        'Please give us at least 24 hours’ notice to reschedule or cancel. We send a reminder the day before and two hours ahead so your bay and technician are ready.',
    },
    {
      handle: 'diagnostic-deposit',
      name: 'Diagnostic deposit',
      depositType: 'deposit',
      depositAmountCents: 7500,
      cancellationWindowHours: 48,
      reminderOffsetsMin: [2880, 1440, 120],
      policyText:
        'Longer bookings hold a $75 deposit that comes straight off your final invoice. Reschedule with 48 hours’ notice and it carries over to your new time.',
    },
  ],
  resources: [
    {
      handle: 'klaus',
      name: 'Klaus Adler',
      kind: 'staff',
      skillTags: ['diagnostics', 'german', 'performance'],
      windows: hours([1, 2, 3, 4, 5], 480, 1080), // Mon–Fri 8–6
    },
    {
      handle: 'dieter',
      name: 'Dieter Voss',
      kind: 'staff',
      skillTags: ['maintenance', 'brakes', 'electrical'],
      windows: hours([1, 2, 3, 4, 5, 6], 480, 1020), // Mon–Sat 8–5
    },
    {
      handle: 'lena',
      name: 'Lena Brandt',
      kind: 'staff',
      skillTags: ['inspection', 'engine', 'transmission'],
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
      windows: hours([1, 2, 3, 4, 5, 6], 480, 1080), // Mon–Sat 8–6
    },
  ],
  services: [
    {
      handle: 'pre-purchase-inspection',
      name: 'Pre-purchase inspection',
      description:
        'Thinking of buying? We put the car on the lift and give you a documented, honest verdict before you sign.',
      durationMinutes: 120,
      priceCents: 25000,
      bufferAfterMin: 15,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'tech', kind: 'staff', skillTags: ['inspection'], count: 1 },
        { role: 'bay', kind: 'space', skillTags: ['bay'], count: 1 },
      ],
      policyHandle: 'diagnostic-deposit',
    },
    {
      handle: 'scheduled-maintenance',
      name: 'Scheduled maintenance',
      description:
        'Your factory service interval done to the book — fluids, filters, inspection points — with OEM-grade parts.',
      durationMinutes: 90,
      priceCents: 18000,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'tech', kind: 'staff', skillTags: ['maintenance'], count: 1 },
        { role: 'bay', kind: 'space', skillTags: ['bay'], count: 1 },
      ],
      policyHandle: 'shop-standard',
    },
    {
      handle: 'diagnostic-scan',
      name: 'Diagnostic scan',
      description:
        'Dealer-level fault-code read and live-data analysis on the factory interface — then a plain-English plan.',
      durationMinutes: 60,
      priceCents: 15000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'tech', kind: 'staff', skillTags: ['diagnostics'], count: 1 },
        { role: 'bay', kind: 'space', skillTags: ['bay'], count: 1 },
      ],
      policyHandle: 'shop-standard',
    },
    {
      handle: 'brake-service',
      name: 'Brake service',
      description:
        'Pads, rotors and sensors matched to your marque — measured, torqued to spec and bedded in properly.',
      durationMinutes: 120,
      priceCents: 42000,
      bufferAfterMin: 15,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'tech', kind: 'staff', skillTags: ['brakes'], count: 1 },
        { role: 'bay', kind: 'space', skillTags: ['bay'], count: 1 },
      ],
      policyHandle: 'diagnostic-deposit',
    },
    {
      handle: 'performance-upgrade-consult',
      name: 'Performance upgrade consult',
      description:
        'Tuning, suspension, intake or exhaust — sit down with a specialist and map a build that stays reliable. No charge.',
      durationMinutes: 45,
      priceCents: 0,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'tech', kind: 'staff', skillTags: ['performance'], count: 1 },
        { role: 'bay', kind: 'space', skillTags: ['bay'], count: 1 },
      ],
      policyHandle: 'shop-standard',
    },
    {
      handle: 'oil-service',
      name: 'Oil & filter service',
      description:
        'Full-synthetic oil to your car’s exact specification and a genuine filter — reset service light included.',
      durationMinutes: 45,
      priceCents: 14000,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'tech', kind: 'staff', skillTags: ['maintenance'], count: 1 },
        { role: 'bay', kind: 'space', skillTags: ['bay'], count: 1 },
      ],
      policyHandle: 'shop-standard',
    },
    {
      handle: 'check-engine-diagnosis',
      name: 'Check-engine diagnosis',
      description:
        'Light on? We scan it, trace the real cause and quote the fix — the scan itself is on us.',
      durationMinutes: 60,
      priceCents: 0,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'tech', kind: 'staff', skillTags: ['diagnostics'], count: 1 },
        { role: 'bay', kind: 'space', skillTags: ['bay'], count: 1 },
      ],
      policyHandle: 'shop-standard',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  photoHero({
    image: url(IMG.hero),
    alt: 'A European performance sedan in a clean service bay under focused light',
    title: 'European precision, kept to spec',
    sub: 'BMW, Mercedes, Audi, Porsche and VW — diagnosed, serviced and dialed in by factory-trained technicians, without the dealer markup.',
    primary: { label: 'Book service', href: '/book' },
    secondary: { label: 'See what we do', href: '/book' },
    overlay: 'darker',
  }),
  featureRow({
    items: [
      {
        title: 'Factory-trained technicians',
        body: 'Marque-certified master techs who work on your make every day — not a generalist meeting it for the first time.',
      },
      {
        title: 'Dealer-level diagnostics',
        body: 'The same factory interfaces the dealer uses, reading live data and coding to spec — so the fix is the real fix.',
      },
      {
        title: 'OEM & performance parts',
        body: 'Genuine and OE-grade components as standard, with proven performance parts when you want more from the car.',
      },
      {
        title: 'No dealer markup',
        body: 'Dealership expertise and equipment at an independent’s rate — with a straight answer on what actually needs doing.',
      },
    ],
  }),
  serviceMenu({
    heading: 'Book a visit',
    intro: 'The services we book most. Full pricing and live availability are on the booking page — pick a technician and a bay opens up.',
    surface: 'muted',
    columns: 2,
    items: [
      { name: 'Diagnostic scan', priceCents: 15000, durationMin: 60, desc: 'Factory fault-code read and a plain-English plan.' },
      { name: 'Scheduled maintenance', priceCents: 18000, durationMin: 90, desc: 'Your service interval, done to the book.' },
      { name: 'Pre-purchase inspection', priceCents: 25000, durationMin: 120, desc: 'A documented verdict before you buy.' },
      { name: 'Performance upgrade consult', priceCents: 0, durationMin: 45, desc: 'Map a reliable build with a specialist.' },
    ],
    cta: { label: 'See every service & book', href: '/book' },
  }),
  splitFeature({
    image: url(IMG.diag),
    alt: 'A technician running a factory-level diagnostic scan on a laptop',
    heading: 'Import specialists, not generalists',
    body: [
      'European cars are engineered tightly, and they’re unforgiving of guesswork. Autobahn Werks exists to work on them the way the factory intended — with the right tools, the right procedures and technicians who know the platform cold.',
      'That means we find the actual fault instead of throwing parts at a symptom, we torque and code to spec, and we tell you what can wait and what can’t. Precision is the point — and it’s what keeps a well-built machine feeling built.',
    ],
    cta: { label: 'Book your visit', href: '/book' },
  }),
  teamRow({
    heading: 'Your technicians',
    intro: 'Book by name — the specialist who knows your marque and your history.',
    members: [
      { name: 'Klaus Adler', role: 'Master diagnostic tech', image: url(IMG.klaus), alt: 'Klaus Adler, master diagnostic technician', bio: 'Factory-level diagnostics and performance builds across BMW, Audi and Porsche.' },
      { name: 'Dieter Voss', role: 'Master service tech', image: url(IMG.dieter), alt: 'Dieter Voss, master service technician', bio: 'Scheduled maintenance, brakes and electrical — meticulous, to the book.' },
      { name: 'Lena Brandt', role: 'Master inspection tech', image: url(IMG.lena), alt: 'Lena Brandt, master inspection technician', bio: 'Pre-purchase inspections, engine and transmission work you can trust.' },
    ],
  }),
  testimonial({
    quote: 'They found a coding fault two shops missed, fixed it right the first time, and charged me less than the dealer quoted just to look. My Audi has never run better.',
    attribution: 'Marcus T., S4 owner',
  }),
  bookingCta({
    title: 'Bring us the car',
    sub: 'Choose a service, pick your technician and see live times. Booking takes about a minute.',
    cta: { label: 'Book service', href: '/book' },
  }),
];

const BOOK_INTRO = [
  photoHero({
    image: url(IMG.bay),
    alt: 'A precise, orderly workshop with a car on a lift',
    title: 'Schedule your import',
    sub: 'Choose a service to see pricing and live availability, then pick your technician — a bay is reserved with you automatically.',
    primary: { label: 'See services below', href: '/book' },
    overlay: 'darker',
    align: 'start',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.hero),
    alt: 'A European performance sedan in a clean service bay under focused light',
    heading: 'About Autobahn Werks',
    body: [
      'We opened Autobahn Werks because European drivers deserved a shop that treats their cars as seriously as the engineers who built them — dealer-level capability, without the dealer runaround.',
      'Everyone here is factory-trained on the marques we service, working with the same diagnostic equipment and genuine parts the dealership uses. The difference is the relationship: you book by name, you get a straight answer, and you keep the car that made you fall for it in the first place.',
    ],
    cta: { label: 'Book a visit', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'How we work',
    items: [
      { title: 'Diagnose before we quote', body: 'We confirm the real cause on the factory interface before recommending a repair — no parts-cannon, no guesswork.' },
      { title: 'To-spec, every time', body: 'Torque values, fluids, coding and procedures follow the manufacturer — the way precision engineering expects to be handled.' },
      { title: 'Honest about priorities', body: 'You get a clear picture of what needs doing now and what can safely wait, so you decide with the full story.' },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Find the workshop',
    address: ['Autobahn Werks', '4400 Nürburg Avenue', 'Bay 3 · Austin, TX 78745'],
    mapLocation: '4400 Nürburg Avenue, Austin, TX 78745',
    hours: [
      { day: 'Monday – Friday', time: '8:00 – 6:00' },
      { day: 'Saturday', time: '8:00 – 5:00' },
      { day: 'Sunday', time: 'Closed' },
    ],
  }),
  bookingCta({
    title: 'Rather book than call?',
    sub: 'See live availability and reserve your technician and bay online — no phone tag.',
    surface: 'muted',
    cta: { label: 'Book service', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-auto-euro',
  name: 'sparx — Auto (European Specialist)',
  summary:
    'A precision European-import auto shop — BMW, Mercedes, Audi, Porsche and VW — in a dark graphite palette with a sharp marque-red primary. Installs a working booking flow: factory-trained master technicians you book by name, real service bays as bookable resources (a visit reserves both), and a live menu of diagnostics, scheduled maintenance, performance and pre-purchase inspection with a diagnostic-deposit policy. Ships as "Autobahn Werks" — dealer-level, without the dealer markup.',
  tagline: 'A dark, precise template for European auto specialists — book online from day one.',
  industry: 'Auto repair',
  sortWeight: 71,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'Autobahn Werks', tagline: 'Dealer-level care for European machines.' },
  theme: autobahn,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Autobahn Werks — European import specialists',
      description:
        'Autobahn Werks is a factory-trained BMW, Mercedes, Audi, Porsche and VW specialist — dealer-level diagnostics without the dealer markup. Book your service online.',
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
