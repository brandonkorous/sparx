// sparx-dental-modern — "Arch Dental Studio", a modern COSMETIC & general dental studio.
//
// The design-forward, spa-like end of dentistry: a porcelain near-white ground, a deep
// teal primary, a soft-gold accent and a refined serif display over a humanist sans.
// Veneers, clear aligners, whitening and implants alongside everyday care — calm,
// confident, elevated. Deliberately the OPPOSITE of the warm, friendly FAMILY practice
// sibling (crisp + minimal, not homey), and it shares the booking spine with the rest of
// the service family — a different business, the same functional core: book a consult.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-dental-modern.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-dental-modern/**" \
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
  hero: 'dental-modern-hero',
  chairside: 'dental-modern-chairside',
  elise: 'dental-modern-elise',
  priya: 'dental-modern-priya',
  renae: 'dental-modern-renae',
} as const;

const PHOTO: Record<string, string> = {
  "arch-hero": "https://images.unsplash.com/photo-1629909613654-28e377c37b09?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bW9kZXJuJTIwZGVudGFsJTIwY2xpbmljfGVufDB8MHx8fDE3ODYzODkzMDN8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "arch-chairside": "https://images.unsplash.com/photo-1598256989800-fe5f95da9787?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZGVudGlzdCUyMHBhdGllbnQlMjBjaGFpcnxlbnwwfDB8fHwxNzg2Mzg5MzA2fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "arch-elise": "https://images.unsplash.com/photo-1681939282781-341ac4f61996?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjBkZW50aXN0JTIwcG9ydHJhaXR8ZW58MHwwfHx8MTc4NjM4OTI5MHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "arch-priya": "https://images.unsplash.com/photo-1681939282781-341ac4f61996?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZGVudGFsJTIwcHJvZmVzc2lvbmFsJTIwcG9ydHJhaXR8ZW58MHwwfHx8MTc4NjM4OTMwOXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "arch-renae": "https://images.unsplash.com/photo-1659353888906-adb3e0041693?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjBkb2N0b3IlMjBwb3J0cmFpdHxlbnwwfDB8fHwxNzg2Mzg5MzExfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
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
    url: src('arch-hero'),
    alt: 'A bright, minimal dental studio with clean lines and soft daylight',
  },
  {
    id: IMG.chairside,
    url: src('arch-chairside'),
    alt: 'A calm treatment suite with a modern chair and a large window',
  },
  { id: IMG.elise, url: src('arch-elise'), alt: 'Dr. Elise Marchetti, cosmetic & general dentist' },
  { id: IMG.priya, url: src('arch-priya'), alt: 'Dr. Priya Anand, orthodontist & aligner lead' },
  { id: IMG.renae, url: src('arch-renae'), alt: 'Renae Ford, registered dental hygienist' },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-dental-modern: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "arch": porcelain ground, deep-teal primary, soft-gold accent, serif display ─
const arch = defineTheme({
  name: 'arch',
  type: { body: face('Inter', 'sans-serif'), head: face('Fraunces', 'serif') },
  shape: { selector: '0.25rem', field: '0.25rem', box: '0.375rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(98% 0.004 210)', // porcelain near-white
      'oklch(95% 0.006 205)', // cool mist
      'oklch(90% 0.008 205)', // hairline
      'oklch(24% 0.028 225)', // deep slate ink
    ],
    roles: {
      primary: 'oklch(46% 0.062 200)', // deep teal
      secondary: 'oklch(33% 0.022 225)', // dark slate — micro-labels stay legible on porcelain
      accent: 'oklch(78% 0.072 85)', // soft gold
      neutral: 'oklch(27% 0.016 225)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(22% 0.02 225)',
      'oklch(18% 0.016 225)',
      'oklch(14% 0.012 225)',
      'oklch(95% 0.005 210)',
    ],
    roles: {
      primary: 'oklch(72% 0.08 196)', // luminous teal
      secondary: 'oklch(80% 0.012 210)',
      accent: 'oklch(83% 0.08 85)', // warm gold
      neutral: 'oklch(84% 0.012 210)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the booking spine (policies, providers + suites, the consult menu) ────
const hours = (days: number[], startMinute: number, endMinute: number) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

const SCHEDULING = {
  policies: [
    {
      handle: 'studio-standard',
      name: 'Standard booking',
      depositType: 'none',
      cancellationWindowHours: 48,
      reminderOffsetsMin: [2880, 1440, 120],
      policyText:
        'Please give us at least 48 hours’ notice to change or cancel. We send a reminder two days before, the day before, and two hours ahead.',
    },
    {
      handle: 'consult-deposit',
      name: 'Cosmetic consult deposit',
      depositType: 'deposit',
      depositAmountCents: 5000,
      cancellationWindowHours: 72,
      reminderOffsetsMin: [4320, 1440, 120],
      policyText:
        'Longer cosmetic consultations hold a $50 deposit that comes off your treatment total. Reschedule with 72 hours’ notice and it carries over in full.',
    },
  ],
  resources: [
    {
      handle: 'dr-elise',
      name: 'Dr. Elise Marchetti',
      kind: 'staff',
      skillTags: ['cosmetic', 'veneers', 'implants', 'whitening', 'exam'],
      windows: hours([1, 2, 3, 4], 480, 1020), // Mon–Thu 8–5
    },
    {
      handle: 'dr-priya',
      name: 'Dr. Priya Anand',
      kind: 'staff',
      skillTags: ['aligners', 'ortho', 'exam'],
      windows: hours([2, 3, 4, 5], 540, 1080), // Tue–Fri 9–6
    },
    {
      handle: 'renae',
      name: 'Renae Ford, RDH',
      kind: 'staff',
      skillTags: ['cleaning', 'whitening', 'exam'],
      windows: hours([1, 2, 3, 4, 5], 480, 960), // Mon–Fri 8–4
    },
    {
      handle: 'suite-one',
      name: 'Treatment Suite 1',
      kind: 'space',
      skillTags: ['suite'],
      windows: hours([1, 2, 3, 4, 5], 480, 1080), // Mon–Fri 8–6
    },
    {
      handle: 'suite-two',
      name: 'Treatment Suite 2',
      kind: 'space',
      skillTags: ['suite'],
      windows: hours([1, 2, 3, 4, 5], 480, 1080), // Mon–Fri 8–6
    },
  ],
  services: [
    {
      handle: 'smile-consultation',
      name: 'Smile consultation',
      description:
        'A relaxed, no-pressure sit-down to talk through what you’d like to change, with a look at your options and honest pricing. Always free.',
      durationMinutes: 30,
      priceCents: 0,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'provider', kind: 'staff', skillTags: ['exam'], count: 1 },
        { role: 'suite', kind: 'space', skillTags: ['suite'], count: 1 },
      ],
      policyHandle: 'studio-standard',
    },
    {
      handle: 'new-patient-exam',
      name: 'New patient exam',
      description:
        'A thorough first visit: digital images, a full check of your teeth and gums, and a clear plan for keeping them healthy.',
      durationMinutes: 60,
      priceCents: 9900,
      bufferAfterMin: 10,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'provider', kind: 'staff', skillTags: ['exam'], count: 1 },
        { role: 'suite', kind: 'space', skillTags: ['suite'], count: 1 },
      ],
      policyHandle: 'studio-standard',
    },
    {
      handle: 'cleaning',
      name: 'Cleaning & polish',
      description:
        'A gentle professional clean with one of our hygienists — plaque and stain removed, teeth polished, gums cared for.',
      durationMinutes: 60,
      priceCents: 14900,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'provider', kind: 'staff', skillTags: ['cleaning'], count: 1 },
        { role: 'suite', kind: 'space', skillTags: ['suite'], count: 1 },
      ],
      policyHandle: 'studio-standard',
    },
    {
      handle: 'whitening',
      name: 'Professional whitening',
      description:
        'In-studio whitening that lifts everyday stains several shades in a single visit — brighter, but still natural.',
      durationMinutes: 90,
      priceCents: 39900,
      bufferAfterMin: 10,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'provider', kind: 'staff', skillTags: ['whitening'], count: 1 },
        { role: 'suite', kind: 'space', skillTags: ['suite'], count: 1 },
      ],
      policyHandle: 'studio-standard',
    },
    {
      handle: 'clear-aligner-consult',
      name: 'Clear aligner consult',
      description:
        'For straightening without braces: we scan your teeth and show you a preview of the finish, plus timing and cost. Consult is free.',
      durationMinutes: 45,
      priceCents: 0,
      bufferAfterMin: 10,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'provider', kind: 'staff', skillTags: ['aligners'], count: 1 },
        { role: 'suite', kind: 'space', skillTags: ['suite'], count: 1 },
      ],
      policyHandle: 'consult-deposit',
    },
    {
      handle: 'veneers-consult',
      name: 'Veneers design consult',
      description:
        'Veneers are thin, custom covers bonded to the front of your teeth. We design the look with you and map out each step. Consult is free.',
      durationMinutes: 60,
      priceCents: 0,
      bufferAfterMin: 15,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'provider', kind: 'staff', skillTags: ['veneers'], count: 1 },
        { role: 'suite', kind: 'space', skillTags: ['suite'], count: 1 },
      ],
      policyHandle: 'consult-deposit',
    },
    {
      handle: 'implant-consult',
      name: 'Dental implant consult',
      description:
        'An implant replaces a missing tooth with a fixed, natural-looking one. We assess what’s possible and talk timing, comfort and cost. Consult is free.',
      durationMinutes: 60,
      priceCents: 0,
      bufferAfterMin: 15,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'provider', kind: 'staff', skillTags: ['implants'], count: 1 },
        { role: 'suite', kind: 'space', skillTags: ['suite'], count: 1 },
      ],
      policyHandle: 'consult-deposit',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  photoHero({
    image: url(IMG.hero),
    alt: 'A bright, minimal dental studio with clean lines and soft daylight',
    title: 'A calmer way to love your smile',
    sub: 'A modern studio for cosmetic and everyday dental care — veneers, clear aligners, whitening and implants, done gently and beautifully.',
    primary: { label: 'Book a consultation', href: '/book' },
    secondary: { label: 'See what we do', href: '/book' },
    overlay: 'dark',
  }),
  featureRow({
    items: [
      {
        title: 'Design your smile digitally',
        body: 'Before anything is done, we scan your teeth and show you a preview of the result — so you decide with a picture, not a promise.',
      },
      {
        title: 'Straighten without braces',
        body: 'Clear aligners are near-invisible trays that gently move your teeth. Most people barely notice you’re wearing them.',
      },
      {
        title: 'An unhurried, spa-like visit',
        body: 'No rushing, no lectures. A quiet suite, a friendly team and time to ask every question you have.',
      },
      {
        title: 'Honest, upfront pricing',
        body: 'You’ll always know the cost before we begin. No surprises on the way out, and consultations are free.',
      },
    ],
  }),
  serviceMenu({
    heading: 'What you can book',
    intro: 'A few of the visits we see most. Every consultation is free — full pricing and live times are on the booking page.',
    surface: 'muted',
    columns: 2,
    items: [
      {
        name: 'Smile consultation',
        priceCents: 0,
        durationMin: 30,
        desc: 'Talk through what you’d change, with honest options.',
      },
      {
        name: 'Veneers design consult',
        priceCents: 0,
        durationMin: 60,
        desc: 'Design a new smile and see it before you commit.',
      },
      {
        name: 'Professional whitening',
        priceCents: 39900,
        durationMin: 90,
        desc: 'Several shades brighter in a single visit.',
      },
      {
        name: 'Cleaning & polish',
        priceCents: 14900,
        durationMin: 60,
        desc: 'A gentle professional clean and polish.',
      },
    ],
    cta: { label: 'See everything & book', href: '/book' },
  }),
  splitFeature({
    image: url(IMG.chairside),
    alt: 'A calm treatment suite with a modern chair and a large window',
    heading: 'We design the smile before we touch a tooth',
    body: [
      'Cosmetic dentistry should never be a guess. We start with a digital scan and a smile preview, so you can see the finish — the shape, the shade, the proportion — and shape it with us until it feels like you.',
      'Only when you love the plan do we begin. It’s the difference between hoping for a result and choosing one.',
    ],
    cta: { label: 'Start with a consult', href: '/book' },
  }),
  teamRow({
    heading: 'The people you’ll meet',
    intro: 'Book by name — you’ll see the clinician who knows your plan.',
    members: [
      {
        name: 'Dr. Elise Marchetti',
        role: 'Cosmetic & general dentist',
        image: url(IMG.elise),
        alt: 'Dr. Elise Marchetti, cosmetic & general dentist',
        bio: 'Leads the studio. Veneers, implants and full smile design — precise, natural, unhurried.',
      },
      {
        name: 'Dr. Priya Anand',
        role: 'Orthodontist & aligner lead',
        image: url(IMG.priya),
        alt: 'Dr. Priya Anand, orthodontist & aligner lead',
        bio: 'Clear aligners and gentle straightening, planned around your real life and timeline.',
      },
      {
        name: 'Renae Ford, RDH',
        role: 'Dental hygienist',
        image: url(IMG.renae),
        alt: 'Renae Ford, registered dental hygienist',
        bio: 'Cleanings, whitening and the calm, thorough care that keeps everything healthy between visits.',
      },
    ],
  }),
  testimonial({
    quote:
      'I put off fixing my front teeth for a decade. They showed me the result on a screen first, and it looked exactly like it does now. I can’t stop smiling in photos.',
    attribution: 'Daniel R., veneers patient',
  }),
  bookingCta({
    title: 'Your new smile starts with a conversation',
    sub: 'Book a free consultation, see your options and live times, and take it from there. It takes about a minute.',
    cta: { label: 'Book a consultation', href: '/book' },
  }),
];

const BOOK_INTRO = [
  photoHero({
    image: url(IMG.chairside),
    alt: 'A calm treatment suite with a modern chair and a large window',
    title: 'Book your visit',
    sub: 'Choose a service to see pricing and live availability, then pick your clinician and a time that works. Consultations are always free.',
    primary: { label: 'See services below', href: '/book' },
    overlay: 'darker',
    align: 'start',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.hero),
    alt: 'A bright, minimal dental studio with clean lines and soft daylight',
    heading: 'About Arch Dental Studio',
    body: [
      'We built Arch to be the dental studio we’d want to visit — calm, modern and genuinely on your side. Cosmetic work and everyday care under one roof, without the cold clinic feeling.',
      'That means real consultations, a preview before any cosmetic treatment, and honest pricing you see up front. Come as you are; leave a little more confident.',
    ],
    cta: { label: 'Book a consultation', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'How we work',
    items: [
      {
        title: 'See it before you decide',
        body: 'Digital scans and a smile preview mean you choose your result from a picture, not a leaflet.',
      },
      {
        title: 'Gentle, modern care',
        body: 'Quiet suites, careful hands and up-to-date techniques designed to keep every visit comfortable.',
      },
      {
        title: 'No pressure, ever',
        body: 'We lay out the options and the costs, then leave the choice with you. The consult is always free.',
      },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Visit the studio',
    address: ['Arch Dental Studio', '410 Marlow Avenue', 'Suite 300 · Austin, TX 78701'],
    mapLocation: '410 Marlow Avenue, Austin, TX 78701',
    hours: [
      { day: 'Monday – Thursday', time: '8:00 – 6:00' },
      { day: 'Friday', time: '8:00 – 4:00' },
      { day: 'Saturday', time: 'By appointment' },
      { day: 'Sunday', time: 'Closed' },
    ],
  }),
  bookingCta({
    title: 'Rather book than call?',
    sub: 'See live availability and reserve your time online — no phone tag, no hold music.',
    surface: 'muted',
    cta: { label: 'Book a consultation', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-dental-modern',
  name: 'sparx — Dental (Modern Cosmetic)',
  summary:
    'A modern cosmetic-and-general dental studio site — a crisp porcelain palette, a deep-teal primary and a refined serif display, with a calm, spa-like structure. Installs a working booking flow: free consults plus whitening, aligners, veneers and implants, clinicians and treatment suites as bookable resources (a visit reserves a provider AND a suite), and a cosmetic-consult deposit policy. Ships as "Arch Dental Studio".',
  tagline: 'A crisp, modern template for cosmetic dental studios — book consults online from day one.',
  industry: 'Dental',
  sortWeight: 69,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'Arch Dental Studio', tagline: 'A calmer way to love your smile.' },
  theme: arch,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Arch Dental Studio — modern cosmetic & general dentistry',
      description:
        'Arch Dental Studio is a calm, modern practice for veneers, clear aligners, whitening, implants and everyday care. Book a free consultation online.',
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
