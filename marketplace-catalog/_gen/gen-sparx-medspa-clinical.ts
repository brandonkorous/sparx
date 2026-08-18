// sparx-medspa-clinical — "Lumen", a clean, clinical-fresh MED SPA / skin clinic.
//
// The results-forward skin clinic of the design research: a clinical-white / pale-mint
// ground, a calm teal-sage primary and a warm-sand accent, a modern sans throughout
// (Outfit over Inter) and bright, credible photography. Deliberately the OPPOSITE of the
// warm champagne-gold editorial med spa — this leads with trust and outcomes, not luxe.
// Same booking spine as the salon templates, a different business.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @wizeworks/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-medspa-clinical.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-medspa-clinical/**" \
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
  hero: 'medspa-clinical-hero',
  clinic: 'medspa-clinical-clinic',
  treatment: 'medspa-clinical-treatment',
  elise: 'medspa-clinical-elise',
  jordan: 'medspa-clinical-jordan',
  simone: 'medspa-clinical-simone',
} as const;

// No hand-picked photo IDs — every seed resolves to a deterministic placeholder so the
// bundle previews without a broken hot-link. A tenant swaps these in the builder.
const PHOTO: Record<string, string> = {
  "lumen-hero": "https://images.unsplash.com/photo-1704455306925-1401c3012117?w=1600&q=80",
  "lumen-clinic": "https://images.unsplash.com/photo-1761718209694-70031ee64f82?w=1600&q=80",
  "lumen-treatment": "https://images.unsplash.com/photo-1761718209794-e0588aafbcc4?w=1600&q=80",
  "lumen-elise": "https://images.unsplash.com/photo-1584432810601-6c7f27d2362b?w=1600&q=80",
  "lumen-jordan": "https://images.unsplash.com/photo-1678695972687-033fa0bdbac9?w=1600&q=80",
  "lumen-simone": "https://images.unsplash.com/photo-1733685372841-0e8235350158?w=1600&q=80",
};
const src = (seed: string): string =>
  PHOTO[seed] ?? `https://picsum.photos/seed/${seed}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}
const ASSETS: Asset[] = [
  { id: IMG.hero, url: src('lumen-hero'), alt: 'A bright, calm treatment room in clinical white and soft mint' },
  { id: IMG.clinic, url: src('lumen-clinic'), alt: 'A clean, light-filled skin-clinic interior' },
  { id: IMG.treatment, url: src('lumen-treatment'), alt: 'A provider performing a facial treatment' },
  { id: IMG.elise, url: src('lumen-elise'), alt: 'Dr. Elise Warren, medical director' },
  { id: IMG.jordan, url: src('lumen-jordan'), alt: 'Jordan Pierce, RN, aesthetic nurse' },
  { id: IMG.simone, url: src('lumen-simone'), alt: 'Simone Alvarez, licensed aesthetician' },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-medspa-clinical: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "lumen": clinical-white/pale-mint ground, teal-sage primary, warm-sand accent ─
const lumen = defineTheme({
  name: 'lumen',
  type: { body: face('Inter', 'sans-serif'), head: face('Outfit', 'sans-serif') },
  shape: { selector: '0.5rem', field: '0.5rem', box: '0.5rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(98.5% 0.006 165)', // clinical white with a faint mint cast
      'oklch(96% 0.013 168)', // pale mint
      'oklch(91% 0.017 170)', // hairline / mint-grey
      'oklch(30% 0.03 225)', // deep slate ink
    ],
    roles: {
      primary: 'oklch(58% 0.07 175)', // calm teal-sage
      secondary: 'oklch(45% 0.022 220)', // slate
      accent: 'oklch(78% 0.062 70)', // warm sand
      neutral: 'oklch(32% 0.02 220)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(22% 0.02 225)', // deep slate
      'oklch(18% 0.018 225)',
      'oklch(14% 0.014 225)',
      'oklch(95% 0.008 165)', // soft clinical-white ink
    ],
    roles: {
      primary: 'oklch(68% 0.09 175)',
      secondary: 'oklch(74% 0.02 220)',
      accent: 'oklch(81% 0.07 70)',
      neutral: 'oklch(82% 0.015 220)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the booking spine (policies, providers + rooms, the treatment menu) ───
const hours = (days: number[], startMinute: number, endMinute: number) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

const SCHEDULING = {
  policies: [
    {
      handle: 'consult-none',
      name: 'Consultation',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [1440, 120],
      policyText:
        'Consultations are complimentary. If your plans change, let us know at least 24 hours ahead so we can offer the time to someone else.',
    },
    {
      handle: 'treatment-deposit',
      name: 'Treatment deposit',
      depositType: 'deposit',
      depositAmountCents: 5000,
      cancellationWindowHours: 48,
      reminderOffsetsMin: [2880, 1440, 120],
      policyText:
        'Treatments hold a $50 deposit that comes off your total on the day. Reschedule with 48 hours’ notice and it carries over; inside that window it’s forfeited.',
    },
  ],
  resources: [
    {
      handle: 'elise',
      name: 'Dr. Elise Warren',
      kind: 'staff',
      skillTags: ['consult', 'analysis', 'peel', 'microneedling', 'laser'],
      windows: hours([2, 3, 4, 5, 6], 540, 1080), // Tue–Sat 9–6
    },
    {
      handle: 'jordan',
      name: 'Jordan Pierce, RN',
      kind: 'staff',
      skillTags: ['consult', 'analysis', 'iv'],
      windows: hours([1, 2, 3, 4, 5], 480, 960), // Mon–Fri 8–4
    },
    {
      handle: 'simone',
      name: 'Simone Alvarez',
      kind: 'staff',
      skillTags: ['consult', 'analysis', 'facial', 'peel', 'microneedling'],
      windows: hours([3, 4, 5, 6, 0], 600, 1140), // Wed–Sun 10–7
    },
    {
      handle: 'room-1',
      name: 'Treatment Room 1',
      kind: 'space',
      windows: hours([1, 2, 3, 4, 5, 6], 480, 1140), // Mon–Sat 8–7
    },
    {
      handle: 'room-2',
      name: 'Treatment Room 2',
      kind: 'space',
      windows: hours([2, 3, 4, 5, 6, 0], 540, 1140), // Tue–Sun 9–7
    },
  ],
  services: [
    {
      handle: 'consultation',
      name: 'Consultation',
      description:
        'A free, no-pressure sit-down with a provider to map out a plan for your skin. Book this first if you’re not sure where to start.',
      durationMinutes: 30,
      priceCents: 0,
      requiresApproval: true,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'provider', kind: 'staff', skillTags: ['consult'], count: 1 },
      ],
      policyHandle: 'consult-none',
    },
    {
      handle: 'skin-analysis',
      name: 'Skin analysis',
      description:
        'A structured assessment with imaging and measured baselines, so every result after it is something you can actually see.',
      durationMinutes: 30,
      priceCents: 7500,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'provider', kind: 'staff', skillTags: ['analysis'], count: 1 },
        { role: 'room', kind: 'space', count: 1 },
      ],
      policyHandle: 'consult-none',
    },
    {
      handle: 'hydrafacial',
      name: 'HydraFacial',
      description: 'A medical-grade cleanse, exfoliation and hydration in one session — visibly fresher skin, zero downtime.',
      durationMinutes: 60,
      priceCents: 19900,
      bufferAfterMin: 10,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'provider', kind: 'staff', skillTags: ['facial'], count: 1 },
        { role: 'room', kind: 'space', count: 1 },
      ],
      policyHandle: 'treatment-deposit',
    },
    {
      handle: 'chemical-peel',
      name: 'Chemical peel',
      description: 'A tailored peel to smooth tone and texture, dialed to your skin and your downtime — light to medium depth.',
      durationMinutes: 45,
      priceCents: 17500,
      bufferAfterMin: 10,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'provider', kind: 'staff', skillTags: ['peel'], count: 1 },
        { role: 'room', kind: 'space', count: 1 },
      ],
      policyHandle: 'treatment-deposit',
    },
    {
      handle: 'microneedling',
      name: 'Microneedling',
      description: 'Collagen-induction therapy for fine lines, scarring and texture — a series builds firmer, clearer skin over time.',
      durationMinutes: 75,
      priceCents: 29900,
      bufferAfterMin: 15,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'provider', kind: 'staff', skillTags: ['microneedling'], count: 1 },
        { role: 'room', kind: 'space', count: 1 },
      ],
      policyHandle: 'treatment-deposit',
    },
    {
      handle: 'laser-hair-removal',
      name: 'Laser hair removal',
      description: 'Comfortable, effective laser hair reduction for face or body, safe across skin types — priced per area.',
      durationMinutes: 30,
      priceCents: 14900,
      bufferAfterMin: 10,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'provider', kind: 'staff', skillTags: ['laser'], count: 1 },
        { role: 'room', kind: 'space', count: 1 },
      ],
      policyHandle: 'treatment-deposit',
    },
    {
      handle: 'iv-therapy',
      name: 'IV therapy',
      description: 'A registered nurse–administered vitamin drip for hydration, energy and recovery — chosen to fit how you feel that day.',
      durationMinutes: 45,
      priceCents: 12500,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'provider', kind: 'staff', skillTags: ['iv'], count: 1 },
        { role: 'room', kind: 'space', count: 1 },
      ],
      policyHandle: 'treatment-deposit',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  photoHero({
    image: url(IMG.hero),
    alt: 'A bright, calm treatment room in clinical white and soft mint',
    title: 'Clearer skin, done properly',
    sub: 'A calm, clinical skin studio where every treatment is planned by a licensed provider and measured against results you can actually see.',
    primary: { label: 'Book a consultation', href: '/book' },
    secondary: { label: 'See treatments', href: '/book' },
    overlay: 'dark',
  }),
  featureRow({
    items: [
      {
        title: 'Results you can measure',
        body: 'We photograph and baseline your skin first, then check back against it — so progress is something you can see, not just feel.',
      },
      {
        title: 'Medical-grade, not spa-grade',
        body: 'Clinical devices and pharmaceutical-strength formulations, used at the right depth for your skin — not a generic day-spa menu.',
      },
      {
        title: 'Licensed providers, every time',
        body: 'A registered nurse or licensed aesthetician performs every treatment, under a medical director. No untrained hands, ever.',
      },
    ],
  }),
  serviceMenu({
    heading: 'Treatments',
    intro: 'A few of the things we do most. Full pricing and live availability are on the booking page — and a free consultation comes first if you’re not sure.',
    surface: 'muted',
    columns: 3,
    items: [
      { name: 'HydraFacial', priceCents: 19900, durationMin: 60, desc: 'Cleanse, exfoliate and hydrate — fresher skin, no downtime.' },
      { name: 'Microneedling', priceCents: 29900, durationMin: 75, desc: 'Collagen-induction therapy for texture, lines and scarring.' },
      { name: 'Chemical peel', priceCents: 17500, durationMin: 45, desc: 'A tailored peel for tone and smoothness, dialed to your skin.' },
      { name: 'Laser hair removal', priceCents: 14900, durationMin: 30, desc: 'Comfortable, effective reduction — safe across skin types.' },
      { name: 'IV therapy', priceCents: 12500, durationMin: 45, desc: 'Nurse-administered drips for hydration, energy and recovery.' },
      { name: 'Skin analysis', priceCents: 7500, durationMin: 30, desc: 'Imaging and measured baselines to plan what comes next.' },
    ],
    cta: { label: 'See everything & book', href: '/book' },
  }),
  splitFeature({
    image: url(IMG.clinic),
    alt: 'A clean, light-filled skin-clinic interior',
    heading: 'The Lumen approach',
    body: [
      'We don’t sell you a package on day one. Every plan starts with a consultation and a proper skin analysis, so what we recommend is based on your skin — not a menu we’re trying to move.',
      'Then we build a course of treatments with clear expectations: what it does, how long it takes, and when you’ll see it. Honest, medical, and paced for real results that hold.',
    ],
    cta: { label: 'Book a consultation', href: '/book' },
  }),
  teamRow({
    heading: 'Your providers',
    intro: 'Book by name — a licensed provider you’ll get to know, with a medical director overseeing every plan.',
    members: [
      { name: 'Dr. Elise Warren', role: 'Medical director', image: url(IMG.elise), alt: 'Dr. Elise Warren, medical director', bio: 'Oversees every treatment plan. Leads peels, microneedling and laser.' },
      { name: 'Jordan Pierce, RN', role: 'Aesthetic nurse', image: url(IMG.jordan), alt: 'Jordan Pierce, RN, aesthetic nurse', bio: 'Registered nurse for IV therapy, skin analysis and consultations.' },
      { name: 'Simone Alvarez', role: 'Licensed aesthetician', image: url(IMG.simone), alt: 'Simone Alvarez, licensed aesthetician', bio: 'Facials, peels and microneedling, with a gentle, thorough hand.' },
    ],
  }),
  testimonial({
    quote: 'The first place that showed me the numbers instead of upselling me. Three months in, my skin genuinely looks like the plan they mapped out.',
    attribution: 'Danielle, client since 2024',
  }),
  bookingCta({
    title: 'Start with a free consultation',
    sub: 'Tell us what’s bothering you and we’ll build a plan — no pressure, no package. It takes about a minute to book.',
    cta: { label: 'Book online', href: '/book' },
  }),
];

const BOOK_INTRO = [
  photoHero({
    image: url(IMG.treatment),
    alt: 'A provider performing a facial treatment',
    title: 'Book your appointment',
    sub: 'Start with a complimentary consultation, or choose a treatment to see live availability and pick your provider and time.',
    primary: { label: 'See services below', href: '/book' },
    overlay: 'darker',
    align: 'start',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.hero),
    alt: 'A bright, calm treatment room in clinical white and soft mint',
    heading: 'About Lumen',
    body: [
      'We opened Lumen to do aesthetic skincare the way medicine should be done — with a real assessment, licensed hands, and outcomes you can measure rather than promises you can’t.',
      'That means a consultation before a credit card, a plan built around your skin, and providers who tell you honestly what will and won’t work. Calm, clean, and genuinely clinical.',
    ],
    cta: { label: 'Book a consultation', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'How we work',
    items: [
      { title: 'Assessment first', body: 'Every plan opens with imaging and a measured baseline, so we treat your actual skin — not a guess.' },
      { title: 'Medical oversight', body: 'A medical director signs off on treatment plans, and a licensed provider performs every session.' },
      { title: 'Paced for results', body: 'We build a realistic course with clear expectations, then check back against your baseline as it holds.' },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Visit the clinic',
    address: ['Lumen Skin Clinic', '410 Marlowe Avenue', 'Suite 300 · Austin, TX 78703'],
    mapLocation: '410 Marlowe Avenue, Austin, TX 78703',
    hours: [
      { day: 'Monday – Friday', time: '8:00 – 7:00' },
      { day: 'Saturday', time: '9:00 – 6:00' },
      { day: 'Sunday', time: '10:00 – 7:00' },
      { day: 'Public holidays', time: 'Closed' },
    ],
  }),
  bookingCta({
    title: 'Rather book than call?',
    sub: 'See live availability and reserve a consultation or treatment online — no phone tag.',
    surface: 'muted',
    cta: { label: 'Book online', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-medspa-clinical',
  name: 'Med Spa (Clinical)',
  summary:
    'A clean, clinical med-spa site — clinical white and pale mint, a calm teal-sage primary and a warm-sand accent, with a modern sans throughout. Installs a working booking flow: a free consultation you approve, plus HydraFacial, peels, microneedling, laser and IV therapy booked to licensed providers across two treatment rooms, with a deposit on treatments. Ships as "Lumen", a results-forward skin clinic.',
  tagline: 'A clinical, results-forward template for med spas — book online from day one.',
  industry: 'Med spa',
  sortWeight: 81,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'Lumen', tagline: 'Clearer skin, done properly.' },
  theme: lumen,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Lumen — a clinical med spa & skin clinic',
      description:
        'Lumen is a clinical skin studio for HydraFacial, peels, microneedling, laser and IV therapy — planned by licensed providers and measured against real results. Book online.',
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
