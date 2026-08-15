// sparx-pest-eco — "GreenShield Pest Solutions", an ECO / NATURAL pest-control company.
//
// The conscientious, prevention-first end of the pest-control lane — botanical and
// low-toxicity treatments, integrated pest management, safe for kids and pets. An earthy
// palette (a sage / forest-green primary, a warm clay accent, a soft cream ground, a deep
// green-charcoal ink), a refined humanist serif display over a humanist sans, and calm,
// natural photography. Deliberately the OPPOSITE of the friendly-conventional pest sibling
// (bright blue, protection plans, extermination language) — same booking spine, a
// different, quieter, health-forward business whose whole first move is a FREE INSPECTION.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-pest-eco.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-pest-eco/**" \
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
  hero: 'pest-eco-hero',
  garden: 'pest-eco-garden',
  ipm: 'pest-eco-ipm',
  elena: 'pest-eco-elena',
  marco: 'pest-eco-marco',
  priya: 'pest-eco-priya',
} as const;

// EMPTY on purpose — picsum `src()` fallback fills every seed at build. Swap a real photo
// in here (keyed by seed) whenever one is licensed, no other edit needed.
const PHOTO: Record<string, string> = {
  "greenshield-hero": "https://images.unsplash.com/photo-1683191457485-42a612eeea57?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Z3JlZW4lMjBob21lJTIwZ2FyZGVufGVufDB8MHx8fDE3ODYzOTM3NjN8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "greenshield-garden": "https://images.unsplash.com/photo-1542323789-c2761a7703fc?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bmF0dXJhbCUyMGdhcmRlbiUyMHBsYW50c3xlbnwwfDB8fHwxNzg2MzkzNzY2fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "greenshield-ipm": "https://images.unsplash.com/photo-1747659629851-a92bd71149f6?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGVzdCUyMGNvbnRyb2wlMjBpbnNwZWN0aW9ufGVufDB8MHx8fDE3ODYzOTM3Njl8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "greenshield-elena": "https://images.unsplash.com/photo-1581091224003-01e7c2e69f6f?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjB0ZWNobmljaWFuJTIwcG9ydHJhaXR8ZW58MHwwfHx8MTc4NjM4ODI1Mnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "greenshield-marco": "https://images.unsplash.com/photo-1764014353079-08ece464a226?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dGVjaG5pY2lhbiUyMHBvcnRyYWl0JTIwbWFufGVufDB8MHx8fDE3ODYzODgyNDl8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "greenshield-priya": "https://images.unsplash.com/photo-1615464670798-6e92fafa2a89?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29ya2VyJTIwcG9ydHJhaXQlMjB3b21hbnxlbnwwfDB8fHwxNzg2MzkzNzc1fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
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
    url: src('greenshield-hero'),
    alt: 'A calm family home with a green garden on a bright, still morning',
  },
  {
    id: IMG.garden,
    url: src('greenshield-garden'),
    alt: 'A lush backyard garden with herbs and flowers along the fence line',
  },
  {
    id: IMG.ipm,
    url: src('greenshield-ipm'),
    alt: 'A technician inspecting a garden bed, checking for pests by hand',
  },
  { id: IMG.elena, url: src('greenshield-elena'), alt: 'Elena Ortiz, botanical treatment lead' },
  { id: IMG.marco, url: src('greenshield-marco'), alt: 'Marco Deyn, IPM and rodent specialist' },
  { id: IMG.priya, url: src('greenshield-priya'), alt: 'Priya Anand, recurring-care technician' },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-pest-eco: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "greenshield": soft cream ground, forest-green primary, warm-clay accent, serif ─
const greenshield = defineTheme({
  name: 'greenshield',
  type: { body: face('Inter', 'sans-serif'), head: face('Fraunces', 'serif') },
  shape: { selector: '0.625rem', field: '0.625rem', box: '0.875rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(97% 0.014 110)', // soft cream
      'oklch(93% 0.018 115)', // warm oat
      'oklch(88% 0.02 130)', // sage hairline
      'oklch(26% 0.024 155)', // deep green-charcoal ink
    ],
    roles: {
      primary: 'oklch(48% 0.1 155)', // forest green
      secondary: 'oklch(34% 0.03 155)', // deep green-charcoal (micro-labels stay readable)
      accent: 'oklch(60% 0.095 55)', // warm clay / terracotta
      neutral: 'oklch(28% 0.024 155)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(23% 0.024 155)',
      'oklch(19% 0.018 155)',
      'oklch(15% 0.014 155)',
      'oklch(95% 0.014 110)',
    ],
    roles: {
      primary: 'oklch(72% 0.11 155)',
      secondary: 'oklch(82% 0.022 125)',
      accent: 'oklch(72% 0.09 55)',
      neutral: 'oklch(85% 0.016 125)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the booking spine (policies, technicians + hours, the eco treatment menu) ─
const hours = (days: number[], startMinute: number, endMinute: number) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

const SCHEDULING = {
  policies: [
    {
      handle: 'pest-standard',
      name: 'Standard booking',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [1440, 120],
      policyText:
        'Please give us at least 24 hours’ notice to move or cancel a visit. We send a reminder the day before and two hours ahead, and we’ll always tell you which technician is coming.',
    },
    {
      handle: 'recurring-plan',
      name: 'Recurring plan',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [1440, 120],
      policyText:
        'Plan visits repeat on the schedule you choose — monthly, bi-monthly or quarterly — with the same technician each time. Skip or reschedule any single visit with 24 hours’ notice; nothing is locked in.',
    },
  ],
  resources: [
    {
      handle: 'elena',
      name: 'Elena Ortiz',
      kind: 'staff',
      skillTags: ['botanical', 'general', 'inspection'],
      windows: hours([1, 2, 3, 4, 5], 480, 1020), // Mon–Fri 8–5
    },
    {
      handle: 'marco',
      name: 'Marco Deyn',
      kind: 'staff',
      skillTags: ['ipm', 'general', 'rodents'],
      windows: hours([2, 3, 4, 5, 6], 480, 1020), // Tue–Sat 8–5
    },
    {
      handle: 'priya',
      name: 'Priya Anand',
      kind: 'staff',
      skillTags: ['botanical', 'recurring', 'general'],
      windows: hours([1, 2, 3, 4, 5], 540, 1080), // Mon–Fri 9–6
    },
  ],
  services: [
    {
      handle: 'free-inspection',
      name: 'Free inspection',
      description:
        'A no-pressure visit to walk your home and yard, find where pests are getting in, and lay out a plan — with a clear, no-obligation quote. Always free, and always safe for kids and pets.',
      durationMinutes: 45,
      priceCents: 0,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'technician', kind: 'staff', skillTags: ['general'], count: 1 },
      ],
      policyHandle: 'pest-standard',
    },
    {
      handle: 'botanical-pest-treatment',
      name: 'Botanical pest treatment',
      description:
        'A targeted treatment using plant-derived, low-toxicity products for common household pests — ants, spiders, roaches — with no harsh fumes and no need to clear the house for hours.',
      durationMinutes: 60,
      priceCents: 14000,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'technician', kind: 'staff', skillTags: ['general'], count: 1 },
      ],
      policyHandle: 'pest-standard',
    },
    {
      handle: 'natural-rodent-control',
      name: 'Natural rodent control',
      description:
        'Humane, exclusion-first rodent control — sealing entry points and using tamper-resistant, pet-safe stations rather than loose poisons, so mice and rats leave and stay gone.',
      durationMinutes: 90,
      priceCents: 22000,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'technician', kind: 'staff', skillTags: ['general'], count: 1 },
      ],
      policyHandle: 'pest-standard',
    },
    {
      handle: 'ipm-assessment',
      name: 'IPM assessment',
      description:
        'A deeper integrated-pest-management review — habitat, moisture, entry points and food sources — with a prevention plan that stops pests coming back instead of just spraying what’s here now.',
      durationMinutes: 75,
      priceCents: 12000,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'technician', kind: 'staff', skillTags: ['general'], count: 1 },
      ],
      policyHandle: 'pest-standard',
    },
    {
      handle: 'ant-treatment',
      name: 'Ant treatment',
      description:
        'A focused treatment for an active ant trail or colony, using bait and botanical barriers placed where they matter — effective on the nest, gentle on the rest of your home.',
      durationMinutes: 45,
      priceCents: 11000,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'technician', kind: 'staff', skillTags: ['general'], count: 1 },
      ],
      policyHandle: 'pest-standard',
    },
    {
      handle: 'mosquito-natural-treatment',
      name: 'Mosquito natural treatment',
      description:
        'A yard treatment that knocks mosquito numbers down with plant-based products and larval-source control — so the garden is usable again without coating it in synthetics.',
      durationMinutes: 60,
      priceCents: 15000,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'technician', kind: 'staff', skillTags: ['general'], count: 1 },
      ],
      policyHandle: 'pest-standard',
    },
    {
      handle: 'recurring-plan-setup',
      name: 'Recurring plan setup',
      description:
        'Set up an ongoing prevention plan — monthly, bi-monthly or quarterly — with the same technician each visit. This first visit dials in your home; the rhythm keeps it pest-free from there.',
      durationMinutes: 60,
      priceCents: 13000,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'technician', kind: 'staff', skillTags: ['general'], count: 1 },
      ],
      policyHandle: 'recurring-plan',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  photoHero({
    image: url(IMG.hero),
    alt: 'A calm family home with a green garden on a bright, still morning',
    title: 'Pest control that’s kind to your home',
    sub: 'Botanical, low-toxicity treatments and prevention-first care — safe for kids, pets and the garden, and tough on the pests you actually want gone.',
    primary: { label: 'Book a free inspection', href: '/book' },
    secondary: { label: 'See our treatments', href: '/book' },
    overlay: 'dark',
  }),
  featureRow({
    items: [
      {
        title: 'Botanical & low-toxicity',
        body: 'We treat with plant-derived, low-toxicity products — no chemical haze, no clearing the house for hours after we leave.',
      },
      {
        title: 'Safe for kids & pets',
        body: 'Nothing harsh left on the floors, counters or garden where little ones and pets end up. You can carry on your day right away.',
      },
      {
        title: 'Prevention-first IPM',
        body: 'Integrated pest management finds why pests are here and shuts it down — so the problem stops coming back, not just today’s bugs.',
      },
      {
        title: 'Satisfaction guaranteed',
        body: 'If pests return between visits, so do we — at no extra charge. We’re not done until your home is genuinely settled.',
      },
    ],
  }),
  serviceMenu({
    heading: 'How we treat',
    intro: 'A few of the visits we do most. Every one uses botanical, low-toxicity methods. Full prices and live availability are on the booking page.',
    surface: 'muted',
    columns: 2,
    items: [
      {
        name: 'Free inspection',
        priceCents: 0,
        durationMin: 45,
        desc: 'A full walk-through and a clear, no-obligation plan.',
      },
      {
        name: 'Botanical pest treatment',
        priceCents: 14000,
        durationMin: 60,
        desc: 'Plant-based treatment for ants, spiders and roaches.',
      },
      {
        name: 'Natural rodent control',
        priceCents: 22000,
        durationMin: 90,
        desc: 'Humane, exclusion-first — seal them out, keep them out.',
      },
      {
        name: 'Mosquito natural treatment',
        priceCents: 15000,
        durationMin: 60,
        desc: 'A plant-based yard treatment to get outside back.',
      },
    ],
    cta: { label: 'See everything & book', href: '/book' },
  }),
  splitFeature({
    image: url(IMG.ipm),
    alt: 'A technician inspecting a garden bed, checking for pests by hand',
    heading: 'Why we lead with prevention',
    body: [
      'Spraying kills what’s in front of you today. It doesn’t answer why the pests came — the gap under the door, the standing water, the food left out overnight — so a week later they’re back and the can comes out again.',
      'Integrated pest management works the other way around. We find the cause first, close it off, and use the gentlest thing that works. Fewer chemicals, fewer callbacks, and a home that stays settled instead of being sprayed on a schedule.',
    ],
    cta: { label: 'Book a free inspection', href: '/book' },
  }),
  teamRow({
    heading: 'Who comes to your home',
    intro: 'Book by name — you’ll see the same technician each visit, and they’ll get to know your home and yard.',
    members: [
      {
        name: 'Elena Ortiz',
        role: 'Botanical treatment lead',
        image: url(IMG.elena),
        alt: 'Elena Ortiz, botanical treatment lead',
        bio: 'Elena runs our botanical treatments and inspections, and trains the team on the low-toxicity method.',
      },
      {
        name: 'Marco Deyn',
        role: 'IPM & rodent specialist',
        image: url(IMG.marco),
        alt: 'Marco Deyn, IPM and rodent specialist',
        bio: 'Exclusion, rodent work and the deeper IPM assessments — the find-the-cause, seal-it-out visits.',
      },
      {
        name: 'Priya Anand',
        role: 'Recurring-care technician',
        image: url(IMG.priya),
        alt: 'Priya Anand, recurring-care technician',
        bio: 'Priya looks after recurring plans, keeping the same rhythm and the same standard visit to visit.',
      },
    ],
  }),
  testimonial({
    quote:
      'We have two toddlers and a dog, so “just spray it” was never going to work for us. GreenShield sealed up where the ants were getting in and treated with something I didn’t have to worry about. Gone, and nobody had to leave the house.',
    attribution: 'Renata, homeowner since 2024',
    surface: 'muted',
  }),
  bookingCta({
    title: 'Start with a free inspection',
    sub: 'We’ll find the problem, show you the plan and quote it — no obligation. Booking takes about a minute.',
    cta: { label: 'Book a free inspection', href: '/book' },
  }),
];

const BOOK_INTRO = [
  photoHero({
    image: url(IMG.garden),
    alt: 'A lush backyard garden with herbs and flowers along the fence line',
    title: 'Book your visit',
    sub: 'Start with a free inspection, or choose a treatment to see prices and live availability. Pick your technician and a time that suits you.',
    primary: { label: 'See visits below', href: '/book' },
    overlay: 'darker',
    align: 'start',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.garden),
    alt: 'A lush backyard garden with herbs and flowers along the fence line',
    heading: 'About GreenShield Pest Solutions',
    body: [
      'GreenShield started from a simple conviction: getting rid of pests shouldn’t mean filling your home with chemicals — especially with kids, pets and a garden you actually want to use.',
      'So we built a pest-control company around botanical, low-toxicity treatments and integrated pest management — the kind of results you can trust, delivered by the same technician who learns your home.',
    ],
    cta: { label: 'Book a free inspection', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'How we work',
    items: [
      {
        title: 'Cause before cure',
        body: 'Every visit starts by finding why pests are here — entry points, moisture, food — not just treating what’s crawling today.',
      },
      {
        title: 'The gentlest thing that works',
        body: 'We reach for botanical, low-toxicity products first, and only ever use the least we need to get a lasting result.',
      },
      {
        title: 'Standing behind it',
        body: 'If pests come back between scheduled visits, so do we, at no extra charge. The plan isn’t working until your home is settled.',
      },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Reach GreenShield',
    address: ['GreenShield Pest Solutions', '210 Cedar Line', 'Unit B · Portland, OR 97211'],
    mapLocation: '210 Cedar Line, Portland, OR 97211',
    hours: [
      { day: 'Monday – Friday', time: '8:00 – 6:00' },
      { day: 'Saturday', time: '8:00 – 5:00' },
      { day: 'Sunday', time: 'Closed' },
    ],
  }),
  bookingCta({
    title: 'Rather book than call?',
    sub: 'See live availability and reserve your free inspection online — no phone tag, no quote forms to chase.',
    surface: 'muted',
    cta: { label: 'Book a free inspection', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-pest-eco',
  name: 'Pest Control (Eco)',
  summary:
    'An eco, botanical pest-control site — a natural sage-and-clay palette on a soft cream ground, refined type and calm, natural photography. Installs a working booking flow: real inspections and treatments (free inspection, botanical treatment, natural rodent control, IPM assessment, ant and mosquito treatments, recurring-plan setup), three technicians you book by name with their own hours, and a low-toxicity promise safe for kids and pets. Ships as "GreenShield Pest Solutions".',
  tagline: 'A natural, prevention-first template for pest-control services — book online from day one.',
  industry: 'Pest control',
  sortWeight: 27,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'GreenShield Pest Solutions', tagline: 'Gone for good, gently.' },
  theme: greenshield,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'GreenShield Pest Solutions — eco, botanical pest control',
      description:
        'GreenShield is an eco pest-control company using botanical, low-toxicity treatments and integrated pest management — safe for kids and pets. Book a free inspection online.',
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
