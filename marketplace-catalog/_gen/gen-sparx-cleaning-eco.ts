// sparx-cleaning-eco — "Verdi Clean", an ECO / GREEN residential + boutique cleaning service.
//
// The natural, refined end of the cleaning lane — non-toxic, plant-based products, safe
// for kids, pets and sensitive homes. An earthy palette (a sage-green primary, a warm clay
// accent, a soft cream ground, a deep-forest ink), a refined humanist-serif display over a
// humanist sans, and calm, plant-filled photography. Deliberately the OPPOSITE of the
// bright, cheerful everyday-cleaning sibling — same booking spine, a different, quieter,
// health-forward business.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-cleaning-eco.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-cleaning-eco/**" \
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
  hero: 'cleaning-eco-hero',
  products: 'cleaning-eco-products',
  home: 'cleaning-eco-home',
  rosa: 'cleaning-eco-rosa',
  mara: 'cleaning-eco-mara',
  tavi: 'cleaning-eco-tavi',
} as const;

const PHOTO: Record<string, string> = {
  "verdi-hero": "https://images.unsplash.com/photo-1626965654957-fef1cb80d4b7?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2xlYW4lMjBwbGFudCUyMGZpbGxlZCUyMGhvbWV8ZW58MHwwfHx8MTc4NjM4OTMzMnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "verdi-products": "https://images.unsplash.com/photo-1650964336599-a6b32f916378?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bmF0dXJhbCUyMGNsZWFuaW5nJTIwcHJvZHVjdHN8ZW58MHwwfHx8MTc4NjM4OTMzNXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "verdi-home": "https://images.unsplash.com/photo-1728649054288-61f332ee389b?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YnJpZ2h0JTIwbWluaW1hbCUyMGhvbWUlMjBpbnRlcmlvcnxlbnwwfDB8fHwxNzg2Mzg5MzM4fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "verdi-rosa": "https://images.unsplash.com/photo-1506863530036-1efeddceb993?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjBwb3J0cmFpdCUyMG5hdHVyYWx8ZW58MHwwfHx8MTc4NjM4OTM0MXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "verdi-mara": "https://images.unsplash.com/photo-1680631626569-d163da98ff40?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjBjbGVhbmVyJTIwcG9ydHJhaXR8ZW58MHwwfHx8MTc4NjM4OTMyMHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "verdi-tavi": "https://images.unsplash.com/photo-1758273705627-937374bfa978?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGVyc29uJTIwY2xlYW5pbmclMjBob21lfGVufDB8MHx8fDE3ODYzODkzNDR8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
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
    url: src('verdi-hero'),
    alt: 'A bright, plant-filled living room, freshly cleaned and calm',
  },
  {
    id: IMG.products,
    url: src('verdi-products'),
    alt: 'Refillable bottles of plant-based, non-toxic cleaning products on a wooden shelf',
  },
  {
    id: IMG.home,
    url: src('verdi-home'),
    alt: 'A sunlit kitchen with open windows and green plants on the sill',
  },
  { id: IMG.rosa, url: src('verdi-rosa'), alt: 'Rosa Vela, lead cleaner' },
  { id: IMG.mara, url: src('verdi-mara'), alt: 'Mara Quinn, deep-clean specialist' },
  { id: IMG.tavi, url: src('verdi-tavi'), alt: 'Tavi Okafor, recurring-care cleaner' },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-cleaning-eco: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "verdi": soft cream ground, sage-green primary, warm-clay accent, serif display ─
const verdi = defineTheme({
  name: 'verdi',
  type: { body: face('Inter', 'sans-serif'), head: face('Fraunces', 'serif') },
  shape: { selector: '0.5rem', field: '0.5rem', box: '0.75rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(97% 0.012 105)', // soft cream
      'oklch(93% 0.016 110)', // warm greige
      'oklch(88% 0.018 120)', // sage hairline
      'oklch(28% 0.02 150)', // deep-forest ink
    ],
    roles: {
      primary: 'oklch(52% 0.09 150)', // sage / forest green
      secondary: 'oklch(37% 0.025 150)', // deep green-charcoal (micro-labels stay readable)
      accent: 'oklch(62% 0.09 50)', // warm clay / terracotta
      neutral: 'oklch(30% 0.02 150)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(24% 0.02 150)',
      'oklch(20% 0.015 150)',
      'oklch(16% 0.012 150)',
      'oklch(95% 0.012 105)',
    ],
    roles: {
      primary: 'oklch(70% 0.1 150)',
      secondary: 'oklch(80% 0.02 120)',
      accent: 'oklch(72% 0.09 50)',
      neutral: 'oklch(84% 0.015 120)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the booking spine (policies, cleaners + hours, the green-clean menu) ──
const hours = (days: number[], startMinute: number, endMinute: number) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

const SCHEDULING = {
  policies: [
    {
      handle: 'clean-standard',
      name: 'Standard booking',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [1440, 120],
      policyText:
        'Please give us at least 24 hours’ notice to move or cancel a clean. We send a reminder the day before and two hours ahead, and we’ll always confirm who’s coming.',
    },
    {
      handle: 'recurring-care',
      name: 'Recurring care',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [1440, 120],
      policyText:
        'Recurring cleans repeat on the schedule you set — weekly, fortnightly or monthly — with the same cleaner each visit. Skip or reschedule any single clean with 24 hours’ notice; nothing is locked in.',
    },
  ],
  resources: [
    {
      handle: 'rosa',
      name: 'Rosa Vela',
      kind: 'staff',
      skillTags: ['green', 'standard', 'deep'],
      windows: hours([1, 2, 3, 4, 5], 480, 1020), // Mon–Fri 8–5
    },
    {
      handle: 'mara',
      name: 'Mara Quinn',
      kind: 'staff',
      skillTags: ['green', 'deep', 'move-out'],
      windows: hours([2, 3, 4, 5, 6], 480, 1020), // Tue–Sat 8–5
    },
    {
      handle: 'tavi',
      name: 'Tavi Okafor',
      kind: 'staff',
      skillTags: ['green', 'recurring', 'standard'],
      windows: hours([1, 2, 3, 4, 5], 540, 1080), // Mon–Fri 9–6
    },
  ],
  services: [
    {
      handle: 'home-walkthrough',
      name: 'Home walkthrough',
      description:
        'A free, no-pressure visit — in person or over video — to see your home, talk through what matters to you, and quote your first clean. Sensitive to allergies, pets and little ones.',
      durationMinutes: 60,
      priceCents: 0,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'cleaner', kind: 'staff', skillTags: ['green'], count: 1 }],
      policyHandle: 'clean-standard',
    },
    {
      handle: 'green-standard-clean',
      name: 'Green standard clean',
      description:
        'Our everyday clean, done entirely with plant-based, non-toxic products — kitchen, bathrooms, floors and living spaces left fresh, with nothing harsh left behind.',
      durationMinutes: 120,
      priceCents: 14000,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'cleaner', kind: 'staff', skillTags: ['green'], count: 1 }],
      policyHandle: 'clean-standard',
    },
    {
      handle: 'green-deep-clean',
      name: 'Green deep clean',
      description:
        'A top-to-bottom reset — inside appliances, skirting, tile, the spots that get missed — using the same gentle, low-fume products, ideal for a first visit or a seasonal refresh.',
      durationMinutes: 180,
      priceCents: 24000,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'cleaner', kind: 'staff', skillTags: ['green'], count: 1 }],
      policyHandle: 'clean-standard',
    },
    {
      handle: 'recurring-setup',
      name: 'Recurring clean setup',
      description:
        'Set up an ongoing green clean — weekly, fortnightly or monthly — with the same trusted cleaner each time. This first visit gets your home dialled in; the rhythm carries on from there.',
      durationMinutes: 120,
      priceCents: 13000,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'cleaner', kind: 'staff', skillTags: ['green'], count: 1 }],
      policyHandle: 'recurring-care',
    },
    {
      handle: 'move-out-clean',
      name: 'Move-out clean',
      description:
        'An empty-home deep clean for the end of a lease or a handover — thorough enough for an inspection, still fully plant-based and safe for the next family to walk into.',
      durationMinutes: 240,
      priceCents: 32000,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'cleaner', kind: 'staff', skillTags: ['green'], count: 1 }],
      policyHandle: 'clean-standard',
    },
    {
      handle: 'new-baby-nursery-clean',
      name: 'New-baby nursery clean',
      description:
        'A gentle, fragrance-free clean of the nursery and shared spaces before a baby comes home — no residues, no harsh smells, just a soft, safe room ready for them.',
      durationMinutes: 90,
      priceCents: 12000,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'cleaner', kind: 'staff', skillTags: ['green'], count: 1 }],
      policyHandle: 'clean-standard',
    },
    {
      handle: 'office-green-clean',
      name: 'Office green clean',
      description:
        'A boutique clean for a small studio or office — desks, kitchens and shared surfaces done with low-fume products your whole team can breathe easy around.',
      durationMinutes: 150,
      priceCents: 20000,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'cleaner', kind: 'staff', skillTags: ['green'], count: 1 }],
      policyHandle: 'clean-standard',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  photoHero({
    image: url(IMG.hero),
    alt: 'A bright, plant-filled living room, freshly cleaned and calm',
    title: 'A cleaner home, without the harsh stuff',
    sub: 'Plant-based, non-toxic cleaning for real homes — safe for kids, pets and sensitive noses, and gentle on everything you love.',
    primary: { label: 'Book a green clean', href: '/book' },
    secondary: { label: 'Book a walkthrough', href: '/book' },
    overlay: 'dark',
  }),
  featureRow({
    items: [
      {
        title: 'Plant-based, non-toxic',
        body: 'Everything we use is plant-derived and low-fume — no bleach haze, no chemical smell lingering after we leave.',
      },
      {
        title: 'Safe for kids & pets',
        body: 'No harsh residues on floors, counters or the places little hands and paws end up. You can walk back in right away.',
      },
      {
        title: 'Refillable & low-waste',
        body: 'We work from refillable bottles and washable cloths, so a clean home doesn’t mean a bin full of single-use plastic.',
      },
      {
        title: 'The same trusted cleaner',
        body: 'You’ll see the same person each visit — someone who learns your home, your preferences and what to leave alone.',
      },
    ],
  }),
  serviceMenu({
    heading: 'Ways we clean',
    intro: 'A few of the cleans we do most. Every one uses the same plant-based products. Full prices and live availability are on the booking page.',
    surface: 'muted',
    columns: 2,
    items: [
      {
        name: 'Green standard clean',
        priceCents: 14000,
        durationMin: 120,
        desc: 'Our everyday clean, top to bottom, entirely non-toxic.',
      },
      {
        name: 'Green deep clean',
        priceCents: 24000,
        durationMin: 180,
        desc: 'A full reset — appliances, tile, the spots that get missed.',
      },
      {
        name: 'Recurring clean setup',
        priceCents: 13000,
        durationMin: 120,
        desc: 'An ongoing rhythm with the same cleaner each visit.',
      },
      {
        name: 'New-baby nursery clean',
        priceCents: 12000,
        durationMin: 90,
        desc: 'A gentle, fragrance-free clean before baby comes home.',
      },
    ],
    cta: { label: 'See everything & book', href: '/book' },
  }),
  splitFeature({
    image: url(IMG.products),
    alt: 'Refillable bottles of plant-based, non-toxic cleaning products on a wooden shelf',
    heading: 'Why the products matter',
    body: [
      'Most cleaning leaves something behind — a chemical smell, a film on the counter, fumes that hang in a closed room for hours. In a home with kids, pets or anyone who reacts to that, it adds up.',
      'We clean with plant-based products that actually work and don’t off-gas. Same fresh result, none of the residue — so the room you get back is genuinely clean, not just masked.',
    ],
    cta: { label: 'Book a green clean', href: '/book' },
  }),
  teamRow({
    heading: 'Who comes to your home',
    intro: 'Book by name — you’ll see the same cleaner each visit, and they’ll get to know your place.',
    members: [
      {
        name: 'Rosa Vela',
        role: 'Lead cleaner',
        image: url(IMG.rosa),
        alt: 'Rosa Vela, lead cleaner',
        bio: 'Rosa runs the standard and deep cleans, and trains the team on our plant-based method.',
      },
      {
        name: 'Mara Quinn',
        role: 'Deep-clean specialist',
        image: url(IMG.mara),
        alt: 'Mara Quinn, deep-clean specialist',
        bio: 'Deep cleans and move-outs — the thorough, get-into-the-corners work, done gently.',
      },
      {
        name: 'Tavi Okafor',
        role: 'Recurring-care cleaner',
        image: url(IMG.tavi),
        alt: 'Tavi Okafor, recurring-care cleaner',
        bio: 'Tavi looks after recurring homes, keeping the same rhythm and the same standard week to week.',
      },
    ],
  }),
  testimonial({
    quote:
      'My daughter’s eczema flared after every clean with our old service. Verdi switched us to their non-toxic routine and it just… stopped. The house is fresh and nobody reacts anymore.',
    attribution: 'Danielle, client since 2024',
    surface: 'muted',
  }),
  bookingCta({
    title: 'Ready for a home that’s clean and kind',
    sub: 'Book a green clean, or start with a free walkthrough. It takes about a minute.',
    cta: { label: 'Book a green clean', href: '/book' },
  }),
];

const BOOK_INTRO = [
  photoHero({
    image: url(IMG.home),
    alt: 'A sunlit kitchen with open windows and green plants on the sill',
    title: 'Book your clean',
    sub: 'Choose a clean to see prices and live availability, then pick your cleaner and a time that suits you. Not sure yet? Start with a free walkthrough.',
    primary: { label: 'See cleans below', href: '/book' },
    overlay: 'darker',
    align: 'start',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.home),
    alt: 'A sunlit kitchen with open windows and green plants on the sill',
    heading: 'About Verdi Clean',
    body: [
      'Verdi Clean started with a simple frustration: cleaning a home shouldn’t mean filling it with fumes and chemicals, especially for families, pets and anyone with sensitive skin or lungs.',
      'So we built a cleaning service around plant-based products and real care — the kind of clean you can feel good about, delivered by the same trusted person each time.',
    ],
    cta: { label: 'Book a green clean', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'How we work',
    items: [
      {
        title: 'Plant-based, always',
        body: 'Every clean uses non-toxic, low-fume products — never as an add-on or an upgrade. It’s just how we clean.',
      },
      {
        title: 'Your home, your way',
        body: 'We note what to focus on and what to leave alone — fragile pieces, a napping baby, a nervous dog. It carries over every visit.',
      },
      {
        title: 'Low-waste by habit',
        body: 'Refillable bottles, washable cloths and careful dosing mean less plastic and less down the drain — better for your home and the water it drains to.',
      },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Reach Verdi Clean',
    address: ['Verdi Clean', '54 Maple Row', 'Bay 3 · Portland, OR 97214'],
    mapLocation: '54 Maple Row, Portland, OR 97214',
    hours: [
      { day: 'Monday – Friday', time: '8:00 – 6:00' },
      { day: 'Saturday', time: '8:00 – 5:00' },
      { day: 'Sunday', time: 'Closed' },
    ],
  }),
  bookingCta({
    title: 'Rather book than call?',
    sub: 'See live availability and reserve your clean online — no phone tag, no quote forms to chase.',
    surface: 'muted',
    cta: { label: 'Book a green clean', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-cleaning-eco',
  name: 'Cleaning (Eco)',
  summary:
    'An eco, plant-based residential and boutique cleaning site — a natural sage-and-clay palette on a soft cream ground, refined type and calm, plant-filled photography. Installs a working booking flow: real green cleans (walkthrough, standard, deep, recurring, move-out, nursery, office), three cleaners you book by name with their own hours, and a non-toxic promise safe for kids, pets and sensitive homes. Ships as "Verdi Clean", a premium green cleaning service.',
  tagline: 'A natural, non-toxic template for green cleaning services — book online from day one.',
  industry: 'House cleaning',
  sortWeight: 67,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'Verdi Clean', tagline: 'Clean home, clear conscience.' },
  theme: verdi,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Verdi Clean — eco, plant-based home cleaning',
      description:
        'Verdi Clean is a green cleaning service using plant-based, non-toxic products — safe for kids, pets and sensitive homes. Book a green clean or a free walkthrough online.',
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
