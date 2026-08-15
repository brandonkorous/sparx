// sparx-interior-luxe — "Atelier Nord", a high-end residential INTERIOR DESIGN studio.
//
// The refined, editorial full-service studio of the luxury-interiors lane: a deep charcoal
// ink primary, a warm brass accent, a soft greige/ivory ground, an elegant serif display
// over a humanist sans, and soft-lit interior photography carrying the page. This is the
// LUXE, portfolio-led sibling — full-service design, renovations, furnishing and styling
// for discerning homeowners — deliberately distinct from the approachable e-design
// template: same booking spine, a different business.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-interior-luxe.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-interior-luxe/**" \
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
  STATUS_ON_LIGHT,
  testimonial,
  type ServiceSiteSpec,
} from './service-sites/harness';

// ── Imagery (swap-ready; each id also names an entry in ASSETS) ────────────────────
const IMG = {
  hero: 'interior-luxe-hero',
  process: 'interior-luxe-process',
  about: 'interior-luxe-about',
  work1: 'interior-luxe-work1',
  work2: 'interior-luxe-work2',
  work3: 'interior-luxe-work3',
  work4: 'interior-luxe-work4',
} as const;

const PHOTO: Record<string, string> = {
  "ateliernord-hero": "https://images.unsplash.com/photo-1704040686428-7534b262d0d8?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bHV4dXJ5JTIwbGl2aW5nJTIwcm9vbSUyMGludGVyaW9yfGVufDB8MHx8fDE3ODYzOTMxNjd8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "ateliernord-process": "https://images.unsplash.com/photo-1664638413302-d1ca29ac885b?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8aW50ZXJpb3IlMjBkZXNpZ24lMjBtb29kJTIwYm9hcmR8ZW58MHwwfHx8MTc4NjM5MzE3MHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "ateliernord-about": "https://images.unsplash.com/photo-1558442074-3c19857bc1dc?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZWxlZ2FudCUyMGludGVyaW9yJTIwZGVzaWduZXJ8ZW58MHwwfHx8MTc4NjM5MzE3M3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "ateliernord-work1": "https://images.unsplash.com/photo-1724582586529-62622e50c0b3?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bW9kZXJuJTIwbGl2aW5nJTIwcm9vbSUyMGRlc2lnbnxlbnwwfDB8fHwxNzg2MzkzMTc1fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "ateliernord-work2": "https://images.unsplash.com/photo-1559554704-0f74b35a8718?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZGVzaWduZXIlMjBraXRjaGVuJTIwaW50ZXJpb3J8ZW58MHwwfHx8MTc4NjM5MzE3OHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "ateliernord-work3": "https://images.unsplash.com/photo-1560185893-a55cbc8c57e8?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZWxlZ2FudCUyMGJlZHJvb20lMjBpbnRlcmlvcnxlbnwwfDB8fHwxNzg2MzkzMTgxfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "ateliernord-work4": "https://images.unsplash.com/photo-1658280024253-34cafdfbb002?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bHV4dXJ5JTIwZGluaW5nJTIwcm9vbXxlbnwwfDB8fHwxNzg2MzkzMTg0fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (seed: string): string =>
  PHOTO[seed] ?? `https://picsum.photos/seed/${seed}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}
const ASSETS: Asset[] = [
  { id: IMG.hero, url: src('ateliernord-hero'), alt: 'A serene living room in warm neutrals with considered furniture and soft daylight' },
  { id: IMG.process, url: src('ateliernord-process'), alt: 'A designer’s table with fabric swatches, floor plans and material samples' },
  { id: IMG.about, url: src('ateliernord-about'), alt: 'A calm, light-filled interior with layered textures and natural materials' },
  { id: IMG.work1, url: src('ateliernord-work1'), alt: 'A styled sitting room with a sculptural sofa and warm brass accents' },
  { id: IMG.work2, url: src('ateliernord-work2'), alt: 'A renovated kitchen in muted stone and timber' },
  { id: IMG.work3, url: src('ateliernord-work3'), alt: 'A restful bedroom in soft greige with tailored linen' },
  { id: IMG.work4, url: src('ateliernord-work4'), alt: 'A dining space with a considered mix of vintage and modern pieces' },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-interior-luxe: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "ateliernord": greige-ivory ground, deep charcoal-ink primary, brass accent ─
const ateliernord = defineTheme({
  name: 'ateliernord',
  type: { body: face('Inter', 'sans-serif'), head: face('Fraunces', 'serif') },
  shape: { selector: '0.25rem', field: '0.25rem', box: '0.375rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(96% 0.006 90)', // warm greige-ivory
      'oklch(92% 0.008 88)', // oat
      'oklch(87% 0.01 85)', // hairline
      'oklch(24% 0.012 250)', // deep ink
    ],
    roles: {
      primary: 'oklch(30% 0.014 250)', // deep charcoal ink
      secondary: 'oklch(38% 0.012 250)', // dark slate — readable micro-labels on light
      accent: 'oklch(68% 0.075 75)', // warm brass / camel
      neutral: 'oklch(28% 0.01 250)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(22% 0.01 250)',
      'oklch(18% 0.008 250)',
      'oklch(14% 0.006 250)',
      'oklch(93% 0.006 90)',
    ],
    roles: {
      primary: 'oklch(86% 0.015 90)', // warm ivory — a light fill on the dark ground
      secondary: 'oklch(78% 0.012 90)',
      accent: 'oklch(77% 0.07 76)',
      neutral: 'oklch(84% 0.01 90)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the booking spine (policies, designers + hours, the consultation menu) ─
const hours = (days: number[], startMinute: number, endMinute: number) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

const SCHEDULING = {
  policies: [
    {
      handle: 'atelier-standard',
      name: 'Standard booking',
      depositType: 'none',
      cancellationWindowHours: 48,
      reminderOffsetsMin: [2880, 120],
      policyText:
        'Please give us at least 48 hours’ notice to change or cancel your consultation. We send a reminder two days before and two hours ahead.',
    },
    {
      handle: 'design-deposit',
      name: 'Design deposit',
      depositType: 'deposit',
      depositAmountCents: 10000,
      cancellationWindowHours: 48,
      reminderOffsetsMin: [2880, 1440, 120],
      policyText:
        'Full-service and in-home consultations hold a $100 deposit that is credited toward your project. Reschedule with 48 hours’ notice and it carries over.',
    },
  ],
  resources: [
    {
      handle: 'elise',
      name: 'Elise Marchand',
      kind: 'staff',
      skillTags: ['residential', 'fullservice', 'styling'],
      windows: hours([2, 3, 4, 5, 6], 540, 1080), // Tue–Sat 9–6
    },
    {
      handle: 'henrik',
      name: 'Henrik Vald',
      kind: 'staff',
      skillTags: ['renovation', 'residential', 'sourcing'],
      windows: hours([1, 2, 3, 4, 5], 540, 1080), // Mon–Fri 9–6
    },
    {
      handle: 'sofia',
      name: 'Sofia Lindqvist',
      kind: 'staff',
      skillTags: ['styling', 'residential', 'fullservice'],
      windows: hours([3, 4, 5, 6, 0], 600, 1140), // Wed–Sun 10–7
    },
  ],
  services: [
    {
      handle: 'discovery-call',
      name: 'Discovery call',
      description:
        'A complimentary introductory call to talk through your space, your goals and how we can help.',
      durationMinutes: 30,
      priceCents: 0,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'designer', kind: 'staff', skillTags: ['residential'], count: 1 },
      ],
      policyHandle: 'atelier-standard',
    },
    {
      handle: 'design-consultation',
      name: 'Design consultation',
      description:
        'A focused session on your rooms, your goals and a clear plan for getting there.',
      durationMinutes: 60,
      priceCents: 15000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'designer', kind: 'staff', skillTags: ['residential'], count: 1 },
      ],
      policyHandle: 'atelier-standard',
    },
    {
      handle: 'full-service-design-consult',
      name: 'Full-service design consultation',
      description:
        'The starting consultation for a complete, managed design project — concept through install.',
      durationMinutes: 90,
      priceCents: 25000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'designer', kind: 'staff', skillTags: ['residential'], count: 1 },
      ],
      policyHandle: 'design-deposit',
    },
    {
      handle: 'renovation-consult',
      name: 'Renovation consultation',
      description:
        'For kitchens, baths and larger works — we plan the design, the trades and the timeline together.',
      durationMinutes: 90,
      priceCents: 25000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'designer', kind: 'staff', skillTags: ['residential'], count: 1 },
      ],
      policyHandle: 'design-deposit',
    },
    {
      handle: 'furnishing-styling-consult',
      name: 'Furnishing & styling consultation',
      description:
        'Layering the finishing pieces — furniture, textiles and objects that make a room feel complete.',
      durationMinutes: 60,
      priceCents: 18000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'designer', kind: 'staff', skillTags: ['residential'], count: 1 },
      ],
      policyHandle: 'atelier-standard',
    },
    {
      handle: 'single-room-consult',
      name: 'Single-room consultation',
      description:
        'One room, fully considered — a plan, a palette and the pieces to bring it together.',
      durationMinutes: 60,
      priceCents: 15000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'designer', kind: 'staff', skillTags: ['residential'], count: 1 },
      ],
      policyHandle: 'atelier-standard',
    },
    {
      handle: 'in-home-consultation',
      name: 'In-home consultation',
      description:
        'We come to you — walk the space together, take it in, and map what’s possible on the spot.',
      durationMinutes: 90,
      priceCents: 30000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'designer', kind: 'staff', skillTags: ['residential'], count: 1 },
      ],
      policyHandle: 'design-deposit',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  photoHero({
    image: url(IMG.hero),
    alt: 'A serene living room in warm neutrals with considered furniture and soft daylight',
    title: 'Interiors made for the way you live',
    sub: 'Atelier Nord is a full-service residential design studio — considered rooms, careful renovations and pieces sourced with intention. Book a consultation to begin.',
    primary: { label: 'Book a consultation', href: '/book' },
    secondary: { label: 'See our services', href: '/book' },
    overlay: 'dark',
  }),
  featureRow({
    items: [
      {
        title: 'Full-service, start to finish',
        body: 'From the first sketch to the final cushion, we design, manage and install — so you live with the result, not the logistics.',
      },
      {
        title: 'Trade-only sourcing',
        body: 'We open doors you can’t: to-the-trade fabrics, furniture and finishes, specified and priced with our accounts working in your favour.',
      },
      {
        title: 'Project management included',
        body: 'We hold the trades, the timeline and the budget together, so a renovation runs on schedule and the surprises stay small.',
      },
      {
        title: 'Tailored to your life',
        body: 'No house style stamped onto your home. We design around how you actually use each room, and who you share it with.',
      },
    ],
  }),
  serviceMenu({
    heading: 'Ways to work with us',
    intro: 'Every project starts with a conversation. Here are a few of the ways in — full prices and live availability are on the booking page.',
    surface: 'muted',
    columns: 2,
    items: [
      { name: 'Discovery call', priceCents: 0, durationMin: 30, desc: 'A complimentary call to talk through your space and how we can help.' },
      { name: 'Design consultation', priceCents: 15000, durationMin: 60, desc: 'A focused session on your rooms, your goals and a plan to get there.' },
      { name: 'Full-service design', priceCents: 25000, durationMin: 90, desc: 'The starting consultation for a complete, managed design project.' },
      { name: 'In-home consultation', priceCents: 30000, durationMin: 90, desc: 'We come to you — walk the space together and map the possibilities.' },
    ],
    cta: { label: 'See everything & book', href: '/book' },
  }),
  splitFeature({
    image: url(IMG.process),
    alt: 'A designer’s table with fabric swatches, floor plans and material samples',
    heading: 'How a project unfolds',
    body: [
      'We begin with a conversation and a walk-through, then a considered concept — floor plans, palettes and the pieces that bring a room together, presented so you can picture the whole before a single thing is ordered.',
      'From there we source, manage the trades and handle the install, revealing rooms that feel finished, personal and entirely yours.',
    ],
    cta: { label: 'Book a consultation', href: '/book' },
  }),
  galleryStrip({
    heading: 'Selected interiors',
    surface: 'muted',
    columns: 4,
    images: [
      { src: url(IMG.work1), alt: 'A styled sitting room with a sculptural sofa and warm brass accents' },
      { src: url(IMG.work2), alt: 'A renovated kitchen in muted stone and timber' },
      { src: url(IMG.work3), alt: 'A restful bedroom in soft greige with tailored linen' },
      { src: url(IMG.work4), alt: 'A dining space with a considered mix of vintage and modern pieces' },
    ],
  }),
  testimonial({
    quote: 'They listened before they designed. Every room feels like us, only more considered — and they handled a full renovation without a single sleepless night.',
    attribution: 'The Halvorsen family, whole-home project',
  }),
  bookingCta({
    title: 'Ready to reimagine your home?',
    sub: 'Start with a consultation — choose a designer, see live availability and pick a time that suits you.',
    cta: { label: 'Book a consultation', href: '/book' },
  }),
];

const BOOK_INTRO = [
  photoHero({
    image: url(IMG.process),
    alt: 'A designer’s table with fabric swatches, floor plans and material samples',
    title: 'Book a consultation',
    sub: 'Choose the kind of session that fits your project to see availability, then pick your designer and time.',
    primary: { label: 'See consultations below', href: '/book' },
    overlay: 'darker',
    align: 'start',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.about),
    alt: 'A calm, light-filled interior with layered textures and natural materials',
    heading: 'About Atelier Nord',
    body: [
      'Atelier Nord began with a simple belief: a home should be designed around the people who live in it, not a trend or a template. We work with a small number of residential clients at a time, so every project gets the attention it deserves.',
      'From single rooms to whole-home renovations, we bring the same care — honest advice, considered design, and a calm hand on every detail from concept to install.',
    ],
    cta: { label: 'Book a consultation', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'How we work',
    items: [
      { title: 'A considered pace', body: 'We take on a handful of projects at once. That’s deliberate: it’s how each room gets the thought, sourcing and management it needs.' },
      { title: 'Honest about budget', body: 'We plan to your budget from the first meeting and keep it visible throughout — no creeping numbers, no awkward surprises at the end.' },
      { title: 'Yours, not ours', body: 'The best compliment we get is that a home looks like the people in it. We design to your life, then step back so it’s entirely yours.' },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Visit the studio',
    address: ['Atelier Nord', '14 Harbour Lane', 'Studio 3 · Portland, OR 97209'],
    mapLocation: '14 Harbour Lane, Portland, OR 97209',
    hours: [
      { day: 'Monday – Friday', time: '9:00 – 6:00' },
      { day: 'Saturday', time: 'By appointment' },
      { day: 'Sunday', time: 'Closed' },
    ],
  }),
  bookingCta({
    title: 'Rather book than call?',
    sub: 'See live availability and reserve your consultation online — no phone tag.',
    surface: 'muted',
    cta: { label: 'Book a consultation', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-interior-luxe',
  name: 'Interior Design (Luxe)',
  summary:
    'A refined, editorial site for a high-end interior design studio — a deep charcoal palette, a warm brass accent and an elegant serif display over soft-lit interiors. Installs a working booking flow: consultation types from a complimentary discovery call to full-service and in-home design, three designers you book by name with their own hours, and a design-deposit policy. Ships as "Atelier Nord", a residential design studio.',
  tagline: 'A refined, editorial template for interior design studios — book consultations online from day one.',
  industry: 'Interior design',
  sortWeight: 36,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'Atelier Nord', tagline: 'Considered interiors, start to finish.' },
  theme: ateliernord,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Atelier Nord — a residential interior design studio',
      description:
        'Atelier Nord is a full-service interior design studio for discerning homeowners — considered design, renovations, furnishing and styling. Book a consultation online.',
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
