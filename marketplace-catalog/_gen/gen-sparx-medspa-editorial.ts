// sparx-medspa-editorial — "Aésthète", a warm EDITORIAL med spa / aesthetics clinic.
//
// The boutique-hotel-not-clinic med spa of the design research (SoVous / Aventura lane):
// a champagne ground, an antique-gold primary warmed by one sage healing accent, a
// high-contrast Fraunces serif over a humanist sans, and soft-lit photography carrying
// whitespace-heavy, calm pages. Deliberately the OPPOSITE of a sterile clinical template —
// aesthetics as considered self-care, not a procedure list. Same booking spine as the
// salon templates (a real menu, bookable providers + rooms, hours, a deposit policy), a
// different business.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-medspa-editorial.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-medspa-editorial/**" \
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
  teamRow,
  testimonial,
  type ServiceSiteSpec,
} from './service-sites/harness';

// ── Imagery (swap-ready; each id also names an entry in ASSETS) ────────────────────
const IMG = {
  hero: 'medspa-editorial-hero',
  interior: 'medspa-editorial-interior',
  elise: 'medspa-editorial-elise',
  nadia: 'medspa-editorial-nadia',
  camille: 'medspa-editorial-camille',
  work1: 'medspa-editorial-work1',
  work2: 'medspa-editorial-work2',
  work3: 'medspa-editorial-work3',
} as const;

// No hand-picked photography for this template — every seed resolves through the harness's
// picsum fallback, so the bundle is self-contained and each asset id names a stable image.
const PHOTO: Record<string, string> = {
  "aesthete-hero": "https://images.unsplash.com/photo-1763873993447-1d0be71a96d9?w=1600&q=80",
  "aesthete-interior": "https://images.unsplash.com/photo-1782159981479-5e90597f284a?w=1600&q=80",
  "aesthete-elise": "https://images.unsplash.com/photo-1706795033728-9232ef548a16?w=1600&q=80",
  "aesthete-nadia": "https://images.unsplash.com/photo-1741934023052-26baf5535088?w=1600&q=80",
  "aesthete-camille": "https://images.unsplash.com/photo-1757689373248-a6cd07328ba5?w=1600&q=80",
  "aesthete-work1": "https://images.unsplash.com/photo-1741896135512-084b251887f7?w=1600&q=80",
  "aesthete-work2": "https://images.unsplash.com/photo-1741896136069-f3588d8993b5?w=1600&q=80",
  "aesthete-work3": "https://images.unsplash.com/photo-1743309026555-97f545a08490?w=1600&q=80",
};
const src = (seed: string): string =>
  PHOTO[seed] ?? `https://picsum.photos/seed/${seed}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}
const ASSETS: Asset[] = [
  { id: IMG.hero, url: src('aesthete-hero'), alt: 'A calm, light-filled aesthetics studio in warm champagne tones' },
  { id: IMG.interior, url: src('aesthete-interior'), alt: 'A private treatment room with soft, natural light' },
  { id: IMG.elise, url: src('aesthete-elise'), alt: 'Élise Marchetti, lead aesthetician' },
  { id: IMG.nadia, url: src('aesthete-nadia'), alt: 'Nadia Okafor, nurse injector' },
  { id: IMG.camille, url: src('aesthete-camille'), alt: 'Camille Rousseau, aesthetician and laser specialist' },
  { id: IMG.work1, url: src('aesthete-work1'), alt: 'Lit-from-within skin after a signature facial' },
  { id: IMG.work2, url: src('aesthete-work2'), alt: 'The calm, boutique-hotel treatment space' },
  { id: IMG.work3, url: src('aesthete-work3'), alt: 'Considered detail in the studio' },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-medspa-editorial: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "aesthete": warm champagne ground, antique-gold primary, sage healing accent ─
const aesthete = defineTheme({
  name: 'aesthete',
  type: { body: face('Inter', 'sans-serif'), head: face('Fraunces', 'serif') },
  shape: { selector: '0.5rem', field: '0.5rem', box: '0.5rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(97% 0.012 90)', // warm champagne ivory
      'oklch(94% 0.016 88)', // deeper champagne
      'oklch(89% 0.018 85)', // hairline
      'oklch(24% 0.014 55)', // espresso-charcoal ink
    ],
    roles: {
      primary: 'oklch(62% 0.06 78)', // antique gold
      secondary: 'oklch(40% 0.014 55)', // espresso
      accent: 'oklch(72% 0.03 150)', // sage (healing)
      neutral: 'oklch(26% 0.012 55)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(22% 0.012 55)', // espresso ground
      'oklch(18% 0.01 55)',
      'oklch(14% 0.008 55)',
      'oklch(95% 0.012 90)', // champagne ink
    ],
    roles: {
      primary: 'oklch(76% 0.07 80)', // warmed gold
      secondary: 'oklch(78% 0.014 80)',
      accent: 'oklch(78% 0.04 150)', // sage
      neutral: 'oklch(84% 0.012 80)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the booking spine (policies, providers + rooms + hours, the menu) ─────
const hours = (days: number[], startMinute: number, endMinute: number) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

// Every treatment occupies a provider AND one of the two treatment rooms; consultations
// occupy a provider + room too, so the studio never double-books a space.
const provider = (skillTags: string[]) => ({
  role: 'provider',
  kind: 'staff',
  skillTags,
  count: 1,
});
const room = { role: 'room', kind: 'space', count: 1 };

const SCHEDULING = {
  policies: [
    {
      handle: 'consult-none',
      name: 'Consultation',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [1440, 120],
      policyText:
        'Consultations are free and carry no deposit. If your plans change, just give us 24 hours’ notice. We send a reminder the day before and two hours ahead.',
    },
    {
      handle: 'treatment-deposit',
      name: 'Treatment deposit',
      depositType: 'deposit',
      depositAmountCents: 5000,
      cancellationWindowHours: 48,
      reminderOffsetsMin: [2880, 1440, 120],
      policyText:
        'Treatments hold a $50 deposit that comes off your total. Reschedule with 48 hours’ notice and it carries over to your new time.',
    },
  ],
  resources: [
    {
      handle: 'elise',
      name: 'Élise Marchetti',
      kind: 'staff',
      skillTags: ['facial', 'laser'],
      windows: hours([2, 3, 4, 5, 6], 540, 1080), // Tue–Sat 9–6
    },
    {
      handle: 'nadia',
      name: 'Nadia Okafor',
      kind: 'staff',
      skillTags: ['injectables', 'iv'],
      windows: hours([3, 4, 5, 6, 0], 600, 1140), // Wed–Sun 10–7
    },
    {
      handle: 'camille',
      name: 'Camille Rousseau',
      kind: 'staff',
      skillTags: ['facial', 'laser', 'iv'],
      windows: hours([2, 4, 5, 6], 600, 1080), // Tue, Thu–Sat 10–6
    },
    {
      handle: 'room-1',
      name: 'Treatment Room I',
      kind: 'space',
      windows: hours([2, 3, 4, 5, 6, 0], 540, 1140), // Tue–Sun 9–7
    },
    {
      handle: 'room-2',
      name: 'Treatment Room II',
      kind: 'space',
      windows: hours([2, 3, 4, 5, 6, 0], 540, 1140), // Tue–Sun 9–7
    },
  ],
  services: [
    {
      handle: 'consultation',
      name: 'Consultation',
      description:
        'A relaxed, no-pressure sit-down to understand your skin, map your goals and plan the treatments that actually get you there.',
      durationMinutes: 30,
      priceCents: 0,
      requiresApproval: true,
      assignmentStrategy: 'any_available',
      resourceRequirements: [provider(['facial']), room],
      policyHandle: 'consult-none',
    },
    {
      handle: 'signature-facial',
      name: 'Signature facial',
      description:
        'A tailored deep-cleanse, mask and lymphatic massage — calibrated to your skin for a lit-from-within finish.',
      durationMinutes: 60,
      priceCents: 18500,
      bufferAfterMin: 10,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [provider(['facial']), room],
      policyHandle: 'treatment-deposit',
    },
    {
      handle: 'chemical-peel',
      name: 'Chemical peel',
      description:
        'A resurfacing peel to smooth tone, soften texture and refresh fine lines, with a calming finish.',
      durationMinutes: 45,
      priceCents: 22500,
      bufferAfterMin: 10,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [provider(['facial']), room],
      policyHandle: 'treatment-deposit',
    },
    {
      handle: 'microneedling',
      name: 'Microneedling',
      description:
        'Collagen-boosting micro-channels for firmer, brighter, more even skin — with a serum infusion to finish.',
      durationMinutes: 60,
      priceCents: 35000,
      bufferAfterMin: 15,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [provider(['facial']), room],
      policyHandle: 'treatment-deposit',
    },
    {
      handle: 'injectables-consult',
      name: 'Injectables consultation',
      description:
        'A private consult with our nurse injector to talk through options, expectations and a plan — booked with approval first.',
      durationMinutes: 30,
      priceCents: 0,
      requiresApproval: true,
      assignmentStrategy: 'any_available',
      resourceRequirements: [provider(['injectables']), room],
      policyHandle: 'consult-none',
    },
    {
      handle: 'iv-drip',
      name: 'IV drip therapy',
      description:
        'A hydrating vitamin-and-mineral infusion to restore, replenish and leave you glowing from the inside out.',
      durationMinutes: 45,
      priceCents: 15000,
      assignmentStrategy: 'any_available',
      resourceRequirements: [provider(['iv']), room],
      policyHandle: 'treatment-deposit',
    },
    {
      handle: 'laser-session',
      name: 'Laser session',
      description:
        'Targeted laser for tone, pigment and clarity — a quick, considered session with real results over time.',
      durationMinutes: 30,
      priceCents: 27500,
      bufferAfterMin: 10,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [provider(['laser']), room],
      policyHandle: 'treatment-deposit',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  photoHero({
    image: url(IMG.hero),
    alt: 'A calm, light-filled aesthetics studio in warm champagne tones',
    title: 'Skin you feel at home in',
    sub: 'A calm, boutique studio for considered aesthetics — facials, peels, microneedling and more, planned with you and never rushed.',
    primary: { label: 'Book online', href: '/book' },
    secondary: { label: 'See treatments', href: '/book' },
    overlay: 'soft',
  }),
  featureRow({
    items: [
      {
        title: 'Consult first, always',
        body: 'Every plan starts with a free, unhurried consultation — no pressure and no upselling, just an honest path to the results you want.',
      },
      {
        title: 'Licensed and medical-grade',
        body: 'Your treatments are delivered by trained, licensed providers using clinical-grade products and protocols you can trust.',
      },
      {
        title: 'A calm, private hour',
        body: 'Soft light, a private room and a quiet hour that feels less like a clinic and more like a genuine reset.',
      },
    ],
  }),
  serviceMenu({
    heading: 'The menu',
    intro: 'A few of the treatments we’re known for. Every plan begins with a free consultation, and full prices and live availability are on the booking page.',
    surface: 'muted',
    columns: 2,
    items: [
      { name: 'Signature facial', priceCents: 18500, durationMin: 60, desc: 'A tailored deep-cleanse, mask and massage.' },
      { name: 'Chemical peel', priceCents: 22500, durationMin: 45, desc: 'Resurfacing for smoother tone and texture.' },
      { name: 'Microneedling', priceCents: 35000, durationMin: 60, desc: 'Collagen-boosting for firmer, brighter skin.' },
      { name: 'IV drip therapy', priceCents: 15000, durationMin: 45, desc: 'A hydrating vitamin infusion, head to toe.' },
      { name: 'Laser session', priceCents: 27500, durationMin: 30, desc: 'Targeted laser for tone, pigment and clarity.' },
    ],
    cta: { label: 'See everything & book', href: '/book' },
  }),
  splitFeature({
    image: url(IMG.interior),
    alt: 'A private treatment room with soft, natural light',
    heading: 'A clinic that feels like a retreat',
    body: [
      'Aésthète is a two-room studio, not a treatment mill. We keep the day unhurried so every appointment gets a real consultation, a proper treatment and time to breathe.',
      'That’s the whole idea: fewer people, more attention, and results that come from a plan you understand — not a menu you were talked into.',
    ],
    cta: { label: 'Book your visit', href: '/book' },
  }),
  teamRow({
    heading: 'Your providers',
    intro: 'Book by name — your provider stays with you from the first consultation through your results.',
    members: [
      { name: 'Élise Marchetti', role: 'Lead aesthetician', image: url(IMG.elise), alt: 'Élise Marchetti, lead aesthetician', bio: 'Signature facials and laser. Élise leads the studio and its skin philosophy.' },
      { name: 'Nadia Okafor', role: 'Nurse injector', image: url(IMG.nadia), alt: 'Nadia Okafor, nurse injector', bio: 'Injectables and IV therapy, with a light, natural-looking hand.' },
      { name: 'Camille Rousseau', role: 'Aesthetician & laser specialist', image: url(IMG.camille), alt: 'Camille Rousseau, aesthetician and laser specialist', bio: 'Peels, microneedling and laser for tone, texture and clarity.' },
    ],
  }),
  galleryStrip({
    heading: 'The studio & the results',
    surface: 'muted',
    columns: 3,
    images: [
      { src: url(IMG.work1), alt: 'Lit-from-within skin after a signature facial' },
      { src: url(IMG.work2), alt: 'The calm, boutique-hotel treatment space' },
      { src: url(IMG.work3), alt: 'Considered detail in the studio' },
    ],
  }),
  testimonial({
    quote: 'I came in nervous and left calmer than I’ve felt in months — and my skin has never looked better. It feels like being cared for, not sold to.',
    attribution: 'Renata, client since 2024',
  }),
  bookingCta({
    title: 'Start with a free consultation',
    sub: 'Tell us your goals, meet your provider and see live times. It takes about a minute.',
    cta: { label: 'Book online', href: '/book' },
  }),
];

const BOOK_INTRO = [
  photoHero({
    image: url(IMG.interior),
    alt: 'A private treatment room with soft, natural light',
    title: 'Book your visit',
    sub: 'Choose a treatment or a free consultation to see prices and live availability, then pick your provider and time.',
    primary: { label: 'See treatments below', href: '/book' },
    overlay: 'darker',
    align: 'start',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.hero),
    alt: 'A calm, light-filled aesthetics studio in warm champagne tones',
    heading: 'About Aésthète',
    body: [
      'We opened Aésthète to do aesthetics the way we always wished it were done — calmly, honestly, and around a plan you actually understand.',
      'No pressure, no menu you get talked into, no leaving unsure what happened to your skin. Just licensed, medical-grade care in a room that feels like a retreat.',
    ],
    cta: { label: 'Book a visit', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'How we work',
    items: [
      { title: 'Consultation first', body: 'Every relationship starts with a free, unhurried conversation about your skin, your history and what you actually want.' },
      { title: 'Evidence, not hype', body: 'Clinical-grade products and proven protocols — and honest advice on the short list of treatments worth your time and money.' },
      { title: 'Cared for, not sold to', body: 'We plan for results over time, at a pace that suits you, and we’ll always tell you when the answer is “not yet”.' },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Visit the studio',
    address: ['Aésthète', '210 Marigold Avenue', 'Suite 4 · Portland, OR 97205'],
    mapLocation: '210 Marigold Avenue, Portland, OR 97205',
    hours: [
      { day: 'Tuesday – Friday', time: '9:00 – 7:00' },
      { day: 'Saturday', time: '9:00 – 6:00' },
      { day: 'Sunday', time: '10:00 – 4:00' },
      { day: 'Monday', time: 'Closed' },
    ],
  }),
  bookingCta({
    title: 'Rather book than call?',
    sub: 'See live availability and reserve your consultation or treatment online — no phone tag.',
    surface: 'muted',
    cta: { label: 'Book online', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-medspa-editorial',
  name: 'Med Spa (Editorial)',
  summary:
    'An editorial med-spa site — a champagne-and-gold palette, an antique-gold primary and a healing sage accent under a Fraunces serif, with soft-lit photography carrying calm, boutique-hotel pages. Installs a working booking flow: a real treatment menu (facial, peel, microneedling, IV drip, laser), a free consultation you request, providers you book by name, two treatment rooms and a deposit policy. Ships as "Aésthète", a calm aesthetics clinic.',
  tagline: 'A warm, editorial template for med spas — book online from day one.',
  industry: 'Med spa',
  sortWeight: 82,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'Aésthète', tagline: 'Considered aesthetics, calmly done.' },
  theme: aesthete,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Aésthète — an editorial med spa',
      description:
        'Aésthète is a calm two-room aesthetics studio for facials, peels, microneedling, IV therapy and laser. Start with a free consultation and book your provider online.',
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
