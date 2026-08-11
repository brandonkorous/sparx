// sparx-esthetics-results — "Lumière Skin Studio", a results-driven ESTHETICS studio.
//
// The clean, expert, glow-getter skincare studio: advanced facials, chemical peels,
// dermaplaning, microneedling and acne / anti-aging programs — non-medical, but
// results-first. A luminous near-white ground, a soft-plum primary, a warm-peach
// accent and a refined serif display over a humanist sans, with glowing-skin
// photography carrying the page. Deliberately the RESULTS/ADVANCED sibling — distinct
// from the relaxing express glow-bar template — same booking spine, a different
// business.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-esthetics-results.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-esthetics-results/**" \
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
  hero: 'esthetics-results-hero',
  studio: 'esthetics-results-studio',
  plan: 'esthetics-results-plan',
  camille: 'esthetics-results-camille',
  rosa: 'esthetics-results-rosa',
  ingrid: 'esthetics-results-ingrid',
} as const;

const PHOTO: Record<string, string> = {
  "lumiere-hero": "https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZmFjaWFsJTIwc2tpbmNhcmUlMjB0cmVhdG1lbnR8ZW58MHwwfHx8MTc4NjM5MjY5MHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "lumiere-plan": "https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZXN0aGV0aWNpYW4lMjBmYWNpYWwlMjBjbGllbnR8ZW58MHwwfHx8MTc4NjM5MjY5NXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "lumiere-rosa": "https://images.unsplash.com/photo-1506863530036-1efeddceb993?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjBza2luY2FyZSUyMHByb2Zlc3Npb25hbCUyMHBvcnRyYWl0fGVufDB8MHx8fDE3ODYzOTI3MDB8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "lumiere-ingrid": "https://images.unsplash.com/photo-1506863530036-1efeddceb993?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c2tpbmNhcmUlMjBzcGVjaWFsaXN0JTIwcG9ydHJhaXR8ZW58MHwwfHx8MTc4NjM5MjcwM3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "lumiere-studio": "https://images.unsplash.com/photo-1630835425197-50feeba99ecd?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c3BhJTIwcm9vbSUyMGludGVyaW9yfGVufDB8MHx8fDE3ODYzOTI3Mzl8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "lumiere-camille": "https://images.unsplash.com/photo-1762341113869-0bfa616b4457?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjBzcGElMjB0aGVyYXBpc3QlMjBwb3J0cmFpdHxlbnwwfDB8fHwxNzg2MzkyNzQwfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (seed: string): string =>
  PHOTO[seed] ?? `https://picsum.photos/seed/${seed}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}
const ASSETS: Asset[] = [
  { id: IMG.hero, url: src('lumiere-hero'), alt: 'Clear, luminous skin in soft studio light' },
  { id: IMG.studio, url: src('lumiere-studio'), alt: 'A clean, bright treatment room with a facial bed' },
  { id: IMG.plan, url: src('lumiere-plan'), alt: 'An esthetician reviewing a custom skin plan with a client' },
  { id: IMG.camille, url: src('lumiere-camille'), alt: 'Camille Fontaine, lead esthetician' },
  { id: IMG.rosa, url: src('lumiere-rosa'), alt: 'Rosa Vance, esthetician' },
  { id: IMG.ingrid, url: src('lumiere-ingrid'), alt: 'Ingrid Okafor, advanced-treatment esthetician' },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-esthetics-results: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "lumiere": luminous near-white ground, soft-plum primary, warm-peach accent ─
const lumiere = defineTheme({
  name: 'lumiere',
  type: { body: face('Inter', 'sans-serif'), head: face('Fraunces', 'serif') },
  shape: { selector: '0.25rem', field: '0.25rem', box: '0.375rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(98% 0.006 330)', // luminous near-white, a whisper of plum
      'oklch(95% 0.01 330)', // soft petal
      'oklch(90% 0.014 330)', // hairline
      'oklch(25% 0.02 330)', // deep plum ink
    ],
    roles: {
      primary: 'oklch(58% 0.11 345)', // soft plum-rose
      secondary: 'oklch(34% 0.02 330)', // deep, readable micro-label ink
      accent: 'oklch(80% 0.085 68)', // warm peach-gold
      neutral: 'oklch(30% 0.015 330)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(22% 0.016 330)',
      'oklch(18% 0.013 330)',
      'oklch(14% 0.01 330)',
      'oklch(95% 0.006 330)',
    ],
    roles: {
      primary: 'oklch(74% 0.12 345)',
      secondary: 'oklch(82% 0.015 330)',
      accent: 'oklch(84% 0.09 68)',
      neutral: 'oklch(85% 0.012 330)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the booking spine (policies, estheticians + rooms, the treatment menu) ─
const hours = (days: number[], startMinute: number, endMinute: number) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

const SCHEDULING = {
  policies: [
    {
      handle: 'skin-standard',
      name: 'Standard booking',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [1440, 120],
      policyText:
        'Please give us at least 24 hours’ notice to change or cancel. We send a reminder the day before and two hours ahead.',
    },
    {
      handle: 'advanced-deposit',
      name: 'Advanced-treatment deposit',
      depositType: 'deposit',
      depositAmountCents: 3000,
      cancellationWindowHours: 48,
      reminderOffsetsMin: [2880, 1440, 120],
      policyText:
        'Peels, microneedling and anti-aging appointments hold a $30 deposit that comes off your total. Reschedule with 48 hours’ notice and it carries over; a same-day no-show forfeits the deposit.',
    },
  ],
  resources: [
    {
      handle: 'camille',
      name: 'Camille Fontaine',
      kind: 'staff',
      skillTags: ['facial', 'peel', 'acne'],
      windows: hours([2, 3, 4, 5, 6], 540, 1080), // Tue–Sat 9–6
    },
    {
      handle: 'rosa',
      name: 'Rosa Vance',
      kind: 'staff',
      skillTags: ['facial', 'dermaplaning', 'antiaging'],
      windows: hours([3, 4, 5, 6, 0], 600, 1140), // Wed–Sun 10–7
    },
    {
      handle: 'ingrid',
      name: 'Ingrid Okafor',
      kind: 'staff',
      skillTags: ['facial', 'microneedling', 'peel'],
      windows: hours([2, 4, 5, 6], 600, 1080), // Tue, Thu–Sat 10–6
    },
    {
      handle: 'room-1',
      name: 'Treatment Room 1',
      kind: 'space',
      skillTags: ['treatment-room'],
      windows: hours([2, 3, 4, 5, 6, 0], 540, 1140), // Tue–Sun 9–7
    },
    {
      handle: 'room-2',
      name: 'Treatment Room 2',
      kind: 'space',
      skillTags: ['treatment-room'],
      windows: hours([2, 3, 4, 5, 6, 0], 540, 1140), // Tue–Sun 9–7
    },
  ],
  services: [
    {
      handle: 'skin-consultation',
      name: 'Skin consultation',
      description: 'A no-pressure sit-down to read your skin and map a plan — free, and yours to keep.',
      durationMinutes: 30,
      priceCents: 0,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'esthetician', kind: 'staff', skillTags: ['facial'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['treatment-room'], count: 1 },
      ],
      policyHandle: 'skin-standard',
    },
    {
      handle: 'signature-facial',
      name: 'Signature facial',
      description: 'A deep-cleanse, exfoliation and mask facial tailored to your skin on the day.',
      durationMinutes: 60,
      priceCents: 12000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'esthetician', kind: 'staff', skillTags: ['facial'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['treatment-room'], count: 1 },
      ],
      policyHandle: 'skin-standard',
    },
    {
      handle: 'chemical-peel',
      name: 'Chemical peel',
      description: 'A medical-grade resurfacing peel for tone, texture and a real, visible reset.',
      durationMinutes: 45,
      priceCents: 15000,
      bufferAfterMin: 15,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'esthetician', kind: 'staff', skillTags: ['peel'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['treatment-room'], count: 1 },
      ],
      policyHandle: 'advanced-deposit',
    },
    {
      handle: 'dermaplaning',
      name: 'Dermaplaning',
      description: 'A gentle resurfacing that lifts dead skin and fine hair for an instant glow.',
      durationMinutes: 45,
      priceCents: 11000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'esthetician', kind: 'staff', skillTags: ['dermaplaning'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['treatment-room'], count: 1 },
      ],
      policyHandle: 'skin-standard',
    },
    {
      handle: 'microneedling',
      name: 'Microneedling',
      description: 'Collagen-induction microneedling to soften scarring, pores and fine lines over a series.',
      durationMinutes: 60,
      priceCents: 22000,
      bufferAfterMin: 15,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'esthetician', kind: 'staff', skillTags: ['microneedling'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['treatment-room'], count: 1 },
      ],
      policyHandle: 'advanced-deposit',
    },
    {
      handle: 'acne-treatment',
      name: 'Acne treatment',
      description: 'A targeted deep-clean and extraction facial, part of a plan that clears skin for good.',
      durationMinutes: 60,
      priceCents: 13000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'esthetician', kind: 'staff', skillTags: ['acne'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['treatment-room'], count: 1 },
      ],
      policyHandle: 'skin-standard',
    },
    {
      handle: 'anti-aging-facial',
      name: 'Anti-aging facial',
      description: 'A firming, brightening treatment with active serums for fine lines and lift.',
      durationMinutes: 75,
      priceCents: 18000,
      bufferAfterMin: 10,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'esthetician', kind: 'staff', skillTags: ['antiaging'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['treatment-room'], count: 1 },
      ],
      policyHandle: 'advanced-deposit',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  photoHero({
    image: url(IMG.hero),
    alt: 'Clear, luminous skin in soft studio light',
    title: 'Real results, glowing skin',
    sub: 'A results-driven skincare studio — advanced facials, peels and treatments planned around your skin, not a one-size menu.',
    primary: { label: 'Book a facial', href: '/book' },
    secondary: { label: 'See treatments', href: '/book' },
    overlay: 'dark',
  }),
  featureRow({
    items: [
      {
        title: 'Licensed, expert estheticians',
        body: 'Every treatment is done by a licensed esthetician who reads your skin first — advanced training, not a quick add-on.',
      },
      {
        title: 'Medical-grade, results-first',
        body: 'We use professional, medical-grade products and treatments chosen to actually change your skin — not just feel nice for an hour.',
      },
      {
        title: 'A custom plan, real progress',
        body: 'You leave with a plan built for your skin and your goals, so each visit builds on the last toward clear, glowing results.',
      },
    ],
  }),
  serviceMenu({
    heading: 'Treatments',
    intro: 'A few of the treatments we do most. Full pricing and live availability are on the booking page.',
    surface: 'muted',
    columns: 2,
    items: [
      { name: 'Signature facial', priceCents: 12000, durationMin: 60, desc: 'A deep-cleanse facial tailored to your skin.' },
      { name: 'Chemical peel', priceCents: 15000, durationMin: 45, desc: 'Medical-grade resurfacing for tone and texture.' },
      { name: 'Microneedling', priceCents: 22000, durationMin: 60, desc: 'Collagen-induction for scarring and fine lines.' },
      { name: 'Dermaplaning', priceCents: 11000, durationMin: 45, desc: 'Gentle resurfacing for an instant glow.' },
    ],
    cta: { label: 'See everything & book', href: '/book' },
  }),
  splitFeature({
    image: url(IMG.plan),
    alt: 'An esthetician reviewing a custom skin plan with a client',
    heading: 'A plan built for your skin',
    body: [
      'No two faces are the same, so we never treat them that way. Every visit starts by reading your skin — its history, your routine and what you actually want to change.',
      'From there we build a plan: the right treatments, in the right order, at the right pace. It’s the difference between a nice hour and skin that genuinely gets better.',
    ],
    cta: { label: 'Start with a consult', href: '/book' },
  }),
  teamRow({
    heading: 'Your estheticians',
    intro: 'Book by name — you’ll see the same expert who knows your skin and your plan.',
    members: [
      { name: 'Camille Fontaine', role: 'Lead esthetician', image: url(IMG.camille), alt: 'Camille Fontaine, lead esthetician', bio: 'Acne programs and corrective peels. Camille leads the studio.' },
      { name: 'Rosa Vance', role: 'Esthetician', image: url(IMG.rosa), alt: 'Rosa Vance, esthetician', bio: 'Dermaplaning, glow facials and anti-aging treatments.' },
      { name: 'Ingrid Okafor', role: 'Advanced-treatment esthetician', image: url(IMG.ingrid), alt: 'Ingrid Okafor, advanced-treatment esthetician', bio: 'Microneedling and resurfacing for scarring and texture.' },
    ],
  }),
  testimonial({
    quote: 'Six months of a real plan and my skin is genuinely clear for the first time since my twenties. I trust them completely.',
    attribution: 'Deneen, client since 2024',
  }),
  bookingCta({
    title: 'Ready for skin you love?',
    sub: 'Pick a treatment, choose your esthetician and see live times. Start with a free consult if you’re not sure.',
    cta: { label: 'Book a facial', href: '/book' },
  }),
];

const BOOK_INTRO = [
  photoHero({
    image: url(IMG.studio),
    alt: 'A clean, bright treatment room with a facial bed',
    title: 'Book your treatment',
    sub: 'Choose a treatment to see pricing and live availability, then pick your esthetician and time.',
    primary: { label: 'See treatments below', href: '/book' },
    overlay: 'darker',
    align: 'start',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.hero),
    alt: 'Clear, luminous skin in soft studio light',
    heading: 'About Lumière Skin Studio',
    body: [
      'Lumière is a results-driven skincare studio for people who want their skin to actually change — clearer, brighter, firmer — not just a pampering hour.',
      'We’re licensed estheticians who believe great skin comes from a plan, honest advice and consistency. No upselling, no gimmicks — just expert treatments and real progress you can see.',
    ],
    cta: { label: 'Book a facial', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'How we work',
    items: [
      { title: 'Consultation first', body: 'Every plan begins with reading your skin — its history, your routine and the results you’re after.' },
      { title: 'Medical-grade products', body: 'Professional, results-first products and treatments, plus honest advice on the short list worth taking home.' },
      { title: 'Progress you can see', body: 'We track your skin visit to visit and adjust the plan, so each treatment builds toward a lasting result.' },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Visit the studio',
    address: ['Lumière Skin Studio', '54 Marigold Avenue', 'Suite 3 · Portland, OR 97209'],
    mapLocation: '54 Marigold Avenue, Portland, OR 97209',
    hours: [
      { day: 'Tuesday – Friday', time: '9:00 – 7:00' },
      { day: 'Saturday', time: '9:00 – 6:00' },
      { day: 'Sunday', time: '10:00 – 4:00' },
      { day: 'Monday', time: 'Closed' },
    ],
  }),
  bookingCta({
    title: 'Rather book than call?',
    sub: 'See live availability and reserve your treatment online — no phone tag.',
    surface: 'muted',
    cta: { label: 'Book a facial', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-esthetics-results',
  name: 'sparx — Esthetics (Results)',
  summary:
    'A luminous, results-driven esthetics studio site — a soft-plum palette, a warm-peach accent and a clean near-white ground, with glowing-skin photography. Installs a working booking flow: a real treatment menu (signature facials, chemical peels, dermaplaning, microneedling), licensed estheticians you book by name, two treatment rooms as bookable resources, and a deposit policy. Ships as "Lumière Skin Studio", a clean, expert skincare studio.',
  tagline: 'A clean, expert template for skincare studios — book facials online from day one.',
  industry: 'Esthetics',
  sortWeight: 38,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'Lumière Skin Studio', tagline: 'Real results, glowing skin.' },
  theme: lumiere,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Lumière Skin Studio — results-driven skincare',
      description:
        'Lumière Skin Studio is a results-driven esthetics studio for advanced facials, chemical peels, dermaplaning and microneedling. Book your esthetician online.',
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
