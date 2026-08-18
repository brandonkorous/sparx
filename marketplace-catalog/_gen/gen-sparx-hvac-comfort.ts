// sparx-hvac-comfort — "Evenair Heating & Cooling", a friendly residential HVAC company.
//
// The warm, reassuring, year-round-comfort HVAC company: heating in winter, cooling in
// summer, tune-ups, installs and cleaner indoor air. Its whole personality is a duality —
// a warm heating hue (amber) paired with a cool cooling hue (sky blue) on a clean
// warm-white ground — and its promise is "never too hot, never too cold." Deliberately the
// FRIENDLY, seasonal-comfort sibling: there is a separate efficiency/pro HVAC template
// (green/slate, a savings-and-data angle), so this one leads with warmth and people, not
// spreadsheets. Same booking spine as the rest of the service family — a real menu of
// visits, dispatchable techs with their own hours, a maintenance-plan policy — a business
// that FUNCTIONS on day one.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @wizeworks/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-hvac-comfort.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-hvac-comfort/**" \
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
  hero: 'hvac-comfort-hero',
  install: 'hvac-comfort-install',
  marcus: 'hvac-comfort-marcus',
  dana: 'hvac-comfort-dana',
  luis: 'hvac-comfort-luis',
} as const;

const PHOTO: Record<string, string> = {
  "evenair-hero": "https://images.unsplash.com/photo-1642749776312-aa42ce20c9f5?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YWlyJTIwY29uZGl0aW9uZXIlMjB0ZWNobmljaWFufGVufDB8MHx8fDE3ODYzODgyNDN8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "evenair-install": "https://images.unsplash.com/photo-1757219525975-03b5984bc6e8?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8aHZhYyUyMGluc3RhbGxhdGlvbiUyMHdvcmt8ZW58MHwwfHx8MTc4NjM4ODI0Nnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "evenair-marcus": "https://images.unsplash.com/photo-1764014353079-08ece464a226?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dGVjaG5pY2lhbiUyMHBvcnRyYWl0JTIwbWFufGVufDB8MHx8fDE3ODYzODgyNDl8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "evenair-dana": "https://images.unsplash.com/photo-1581091224003-01e7c2e69f6f?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjB0ZWNobmljaWFuJTIwcG9ydHJhaXR8ZW58MHwwfHx8MTc4NjM4ODI1Mnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "evenair-luis": "https://images.unsplash.com/photo-1759521296144-fe6f2d2dc769?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29ya2VyJTIwcG9ydHJhaXQlMjB1bmlmb3JtfGVufDB8MHx8fDE3ODYzODgyMjR8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
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
    url: src('evenair-hero'),
    alt: 'A comfortable, sunlit family living room on a mild afternoon',
  },
  {
    id: IMG.install,
    url: src('evenair-install'),
    alt: 'A technician checking a home heating and cooling system',
  },
  { id: IMG.marcus, url: src('evenair-marcus'), alt: 'Marcus Reyes, comfort technician' },
  { id: IMG.dana, url: src('evenair-dana'), alt: 'Dana Okonkwo, install lead' },
  { id: IMG.luis, url: src('evenair-luis'), alt: 'Luis Ferraro, service technician' },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-hvac-comfort: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "evenair": comfort duality — amber heating primary + sky-blue cooling accent,
//    warm-white ground, dark-slate secondary (readable on the light ground) ─────────────
const evenair = defineTheme({
  name: 'evenair',
  type: { body: face('Inter', 'sans-serif'), head: face('Outfit', 'sans-serif') },
  shape: { selector: '0.625rem', field: '0.625rem', box: '0.875rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(98% 0.008 75)', // warm white
      'oklch(95% 0.012 72)', // warm haze
      'oklch(90% 0.015 68)', // hairline
      'oklch(27% 0.03 250)', // dark slate ink
    ],
    roles: {
      primary: 'oklch(70% 0.145 55)', // warm amber (heating)
      secondary: 'oklch(38% 0.035 250)', // dark slate
      accent: 'oklch(68% 0.11 232)', // cool sky blue (cooling)
      neutral: 'oklch(30% 0.025 250)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(24% 0.02 250)',
      'oklch(20% 0.018 250)',
      'oklch(16% 0.015 250)',
      'oklch(95% 0.01 75)',
    ],
    roles: {
      primary: 'oklch(78% 0.14 58)',
      secondary: 'oklch(80% 0.03 245)',
      accent: 'oklch(76% 0.11 232)',
      neutral: 'oklch(82% 0.02 245)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the booking spine (policies, techs + hours, the visit menu) ──────────
const hours = (days: number[], startMinute: number, endMinute: number) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

const SCHEDULING = {
  policies: [
    {
      handle: 'evenair-standard',
      name: 'Standard visit',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [1440, 120],
      policyText:
        'Give us a day’s notice if you need to change your visit and we’ll happily move it. We text a reminder the day before and two hours ahead, and our tech calls when they’re on the way.',
    },
    {
      handle: 'evenair-priority',
      name: 'Priority & maintenance',
      depositType: 'none',
      cancellationWindowHours: 12,
      reminderOffsetsMin: [1440, 240, 60],
      policyText:
        'Maintenance-plan members and urgent no-heat / no-cool calls get priority scheduling and same-day windows when they’re open. Change or cancel up to 12 hours ahead at no charge.',
    },
  ],
  resources: [
    {
      handle: 'marcus',
      name: 'Marcus Reyes',
      kind: 'staff',
      skillTags: ['ac', 'heating', 'tune-up'],
      windows: hours([1, 2, 3, 4, 5], 450, 1050), // Mon–Fri 7:30–5:30
    },
    {
      handle: 'dana',
      name: 'Dana Okonkwo',
      kind: 'staff',
      skillTags: ['install', 'heating', 'iaq'],
      windows: hours([1, 2, 3, 4, 5], 480, 1020), // Mon–Fri 8–5
    },
    {
      handle: 'luis',
      name: 'Luis Ferraro',
      kind: 'staff',
      skillTags: ['ac', 'repair', 'emergency', 'tune-up'],
      windows: hours([1, 2, 3, 4, 5, 6], 420, 1140), // Mon–Sat 7–7 (on-call end of week)
    },
  ],
  services: [
    {
      handle: 'free-install-estimate',
      name: 'Free install estimate',
      description:
        'A no-pressure home visit to size up a new furnace, AC or heat pump and give you an honest, written quote — free, with financing options laid out plainly.',
      durationMinutes: 60,
      priceCents: 0,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'tech', kind: 'staff', skillTags: ['install'], count: 1 },
      ],
      policyHandle: 'evenair-standard',
    },
    {
      handle: 'ac-tune-up',
      name: 'AC tune-up',
      description:
        'A full spring check-up so your air conditioner runs cool and efficient all summer — coils, refrigerant, drain and airflow, all cleaned and tested.',
      durationMinutes: 60,
      priceCents: 8900,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'tech', kind: 'staff', skillTags: ['tune-up'], count: 1 },
      ],
      policyHandle: 'evenair-standard',
    },
    {
      handle: 'furnace-tune-up',
      name: 'Furnace tune-up',
      description:
        'A fall safety-and-comfort check on your furnace or heat pump — burners, heat exchanger, filter and thermostat — so winter starts warm and worry-free.',
      durationMinutes: 60,
      priceCents: 9900,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'tech', kind: 'staff', skillTags: ['heating'], count: 1 },
      ],
      policyHandle: 'evenair-standard',
    },
    {
      handle: 'system-diagnostic',
      name: 'System diagnostic',
      description:
        'Something not right — weak airflow, odd noises, uneven rooms? A tech tracks down the cause and explains your options before any work begins.',
      durationMinutes: 75,
      priceCents: 12900,
      bufferAfterMin: 15,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'tech', kind: 'staff', skillTags: ['repair'], count: 1 },
      ],
      policyHandle: 'evenair-standard',
    },
    {
      handle: 'install-consult',
      name: 'Install consultation',
      description:
        'Ready to replace a system? A sit-down with our install lead to plan the right equipment, sizing and timeline for your home — no hard sell.',
      durationMinutes: 90,
      priceCents: 0,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'tech', kind: 'staff', skillTags: ['install'], count: 1 },
      ],
      policyHandle: 'evenair-standard',
    },
    {
      handle: 'air-quality-assessment',
      name: 'Indoor air-quality assessment',
      description:
        'A walkthrough of what you’re breathing at home — filtration, humidity, ventilation and dust — with simple, honest fixes ranked by what actually helps.',
      durationMinutes: 60,
      priceCents: 7900,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'tech', kind: 'staff', skillTags: ['iaq'], count: 1 },
      ],
      policyHandle: 'evenair-standard',
    },
    {
      handle: 'emergency-service',
      name: 'Emergency no-heat / no-cool',
      description:
        'No heat in a cold snap or no cooling in a heat wave? Request a priority visit and we’ll get a tech to you as fast as our schedule allows.',
      durationMinutes: 120,
      priceCents: 17900,
      requiresApproval: true,
      bufferAfterMin: 15,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'tech', kind: 'staff', skillTags: ['emergency'], count: 1 },
      ],
      policyHandle: 'evenair-priority',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  photoHero({
    image: url(IMG.hero),
    alt: 'A comfortable, sunlit family living room on a mild afternoon',
    title: 'Never too hot, never too cold',
    sub: 'Friendly, year-round comfort for your home — heating in winter, cooling in summer, and honest people who show up when they say they will.',
    primary: { label: 'Book a visit', href: '/book' },
    secondary: { label: 'See what we do', href: '/book' },
    overlay: 'dark',
  }),
  featureRow({
    items: [
      {
        title: 'Licensed & NATE-certified',
        body: 'Every tech is licensed, background-checked and NATE-certified — trained on today’s furnaces, air conditioners and heat pumps.',
      },
      {
        title: 'Upfront, written quotes',
        body: 'You see the price before we start, in plain language. No surprises on the invoice, no pressure to buy more than you need.',
      },
      {
        title: 'Seasonal tune-up plans',
        body: 'A simple membership keeps your system checked spring and fall, with priority scheduling and a discount on repairs.',
      },
      {
        title: 'Financing on new systems',
        body: 'A new furnace or AC shouldn’t wait for the perfect month — flexible financing lets you spread it out and stay comfortable now.',
      },
    ],
  }),
  serviceMenu({
    heading: 'Book a visit',
    intro: 'The visits we’re asked for most. Pick one to see live openings and choose a time that works for you.',
    surface: 'muted',
    columns: 2,
    items: [
      {
        name: 'Free install estimate',
        priceCents: 0,
        durationMin: 60,
        desc: 'An honest, written quote for a new system — free.',
      },
      {
        name: 'AC tune-up',
        priceCents: 8900,
        durationMin: 60,
        desc: 'A spring check-up so summer stays cool.',
      },
      {
        name: 'Furnace tune-up',
        priceCents: 9900,
        durationMin: 60,
        desc: 'A fall safety check so winter starts warm.',
      },
      {
        name: 'System diagnostic',
        priceCents: 12900,
        durationMin: 75,
        desc: 'We find the cause and explain your options.',
      },
    ],
    cta: { label: 'See every visit & book', href: '/book' },
  }),
  splitFeature({
    image: url(IMG.install),
    alt: 'A technician checking a home heating and cooling system',
    heading: 'A tune-up now beats a breakdown later',
    body: [
      'Most no-heat calls in January and no-cool calls in July trace back to something a seasonal check-up would have caught. A tuned system runs quieter, lasts longer and costs less to run.',
      'Our Comfort Plan members get a spring and a fall visit, priority scheduling when the weather turns, and a standing discount on any repair — so your home stays comfortable without you having to think about it.',
    ],
    cta: { label: 'Start with a tune-up', href: '/book' },
  }),
  teamRow({
    heading: 'The people who’ll come to your door',
    intro: 'Real techs from right here — friendly, tidy, and happy to explain what they find.',
    members: [
      {
        name: 'Marcus Reyes',
        role: 'Comfort technician',
        image: url(IMG.marcus),
        alt: 'Marcus Reyes, comfort technician',
        bio: 'Fifteen years on furnaces and AC. Marcus is the one who leaves your utility room cleaner than he found it.',
      },
      {
        name: 'Dana Okonkwo',
        role: 'Install lead',
        image: url(IMG.dana),
        alt: 'Dana Okonkwo, install lead',
        bio: 'Plans new systems and cleaner-air upgrades, and sizes them right so you’re never over-sold.',
      },
      {
        name: 'Luis Ferraro',
        role: 'Service technician',
        image: url(IMG.luis),
        alt: 'Luis Ferraro, service technician',
        bio: 'The diagnostics whisperer — and the one you want on an emergency call when the heat’s out.',
      },
    ],
  }),
  testimonial({
    quote: 'Our AC quit during the worst week of summer. Evenair had someone out the same day, fixed it fast, and told us exactly what it’d cost first. We’re on their plan now and never worry about it.',
    attribution: 'The Alvarez family, customers since 2022',
  }),
  bookingCta({
    title: 'Let’s get your home comfortable',
    sub: 'Choose a visit, pick a time that fits your day, and we’ll take it from there. It takes about a minute.',
    cta: { label: 'Book a visit', href: '/book' },
  }),
];

const BOOK_INTRO = [
  photoHero({
    image: url(IMG.install),
    alt: 'A technician checking a home heating and cooling system',
    title: 'Book your visit',
    sub: 'Choose a visit to see prices and live openings, then pick a time that works — you’ll get a confirmation and a reminder before we arrive.',
    primary: { label: 'See visits below', href: '/book' },
    overlay: 'darker',
    align: 'start',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.hero),
    alt: 'A comfortable, sunlit family living room on a mild afternoon',
    heading: 'About Evenair Heating & Cooling',
    body: [
      'We started Evenair because comfort at home shouldn’t come with a hard sell or a mystery invoice. Heating and cooling is what keeps a house livable — and it should be handled by people who treat your home the way they’d treat their own.',
      'So that’s how we run it: licensed techs, upfront prices, tidy work, and honest advice about what your system actually needs. Warm in winter, cool in summer, and no drama in between.',
    ],
    cta: { label: 'Book a visit', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'How we work',
    items: [
      {
        title: 'We size it right',
        body: 'An oversized system short-cycles and an undersized one never keeps up. We measure your home and match the equipment to it — comfort you can feel, bills you’ll notice.',
      },
      {
        title: 'We explain before we fix',
        body: 'You’ll always know what’s wrong, what your options are, and what each one costs before any work starts. The choice is yours, every time.',
      },
      {
        title: 'We stand behind it',
        body: 'Workmanship guaranteed, parts warranties honored, and a real person answers the phone when you call. If something’s not right, we make it right.',
      },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Reach the Evenair team',
    address: ['Evenair Heating & Cooling', '415 Maplewood Avenue', 'Riverton, KS 66101'],
    mapLocation: '415 Maplewood Avenue, Riverton, KS 66101',
    hours: [
      { day: 'Monday – Friday', time: '7:30 – 5:30' },
      { day: 'Saturday', time: '8:00 – 2:00 (service calls)' },
      { day: 'Sunday', time: 'Emergency only' },
      { day: 'After hours', time: 'No-heat / no-cool line open' },
    ],
  }),
  bookingCta({
    title: 'Rather book than call?',
    sub: 'See live openings and reserve your visit online — pick a time, get a confirmation, done.',
    surface: 'muted',
    cta: { label: 'Book a visit', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-hvac-comfort',
  name: 'HVAC (Comfort)',
  summary:
    'A friendly residential HVAC site built on year-round comfort — a warm amber-heating and cool sky-blue palette on a clean warm-white ground. Installs a working booking flow: tune-ups, free install estimates, diagnostics and air-quality visits, three techs dispatched by skill with their own hours, and a maintenance-plan priority policy. Ships as "Evenair Heating & Cooling".',
  tagline: 'A warm, friendly template for HVAC companies — book comfort visits from day one.',
  industry: 'HVAC',
  sortWeight: 76,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'Evenair Heating & Cooling', tagline: 'Never too hot, never too cold.' },
  theme: evenair,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Evenair Heating & Cooling — friendly year-round comfort',
      description:
        'Evenair Heating & Cooling keeps your home comfortable all year — furnace and AC tune-ups, free install estimates, and honest, licensed techs. Book a visit online.',
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
