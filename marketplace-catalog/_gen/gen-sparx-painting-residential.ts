// sparx-painting-residential — "Brushworks Painting", a clean, reliable RESIDENTIAL painter.
//
// The everyday, fresh, photo-led painting company of the trades research — interior &
// exterior painting, cabinets, trim, drywall repair and color consults, done tidy and
// done right. A bright clean-blue primary with a warm accent, a crisp near-white ground
// and real photos of freshly painted rooms carrying the page. The functional core is
// BOOKING A FREE ESTIMATE — homeowners book a walk-through online and get a real time
// slot, exactly how a modern trade runs its schedule. Deliberately the CLEAN, RELIABLE,
// "a fresh coat, done right and clean" sibling of the separate premium fine-finishes
// painting template — same booking spine, an everyday personality.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-painting-residential.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-painting-residential/**" \
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
  hero: 'painting-residential-hero',
  story: 'painting-residential-story',
  maya: 'painting-residential-maya',
  diego: 'painting-residential-diego',
  priya: 'painting-residential-priya',
} as const;

const PHOTO: Record<string, string> = {
  "brushworks-hero": "https://images.unsplash.com/photo-1688372199140-cade7ae820fe?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZnJlc2hseSUyMHBhaW50ZWQlMjByb29tfGVufDB8MHx8fDE3ODYzOTM3Nzd8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "brushworks-story": "https://images.unsplash.com/photo-1688372199140-cade7ae820fe?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGFpbnRlciUyMHBhaW50aW5nJTIwd2FsbHxlbnwwfDB8fHwxNzg2MzkzNzgxfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "brushworks-maya": "https://images.unsplash.com/photo-1696416749433-f0abf2e0c524?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGFpbnRlciUyMHBvcnRyYWl0JTIwd29tYW58ZW58MHwwfHx8MTc4NjM5Mzc4M3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "brushworks-diego": "https://images.unsplash.com/photo-1664482017668-91158897414c?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGFpbnRlciUyMHBvcnRyYWl0JTIwbWFufGVufDB8MHx8fDE3ODYzOTM3ODd8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "brushworks-priya": "https://images.unsplash.com/photo-1615464670798-6e92fafa2a89?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29ya2VyJTIwcG9ydHJhaXQlMjB3b21hbnxlbnwwfDB8fHwxNzg2MzkzNzc1fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
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
    url: src('brushworks-hero'),
    alt: 'A freshly painted, sunlit living room with crisp white trim',
  },
  {
    id: IMG.story,
    url: src('brushworks-story'),
    alt: 'A painter cutting a clean line along the ceiling with a brush',
  },
  { id: IMG.maya, url: src('brushworks-maya'), alt: 'Maya Okonkwo, interior and trim lead' },
  { id: IMG.diego, url: src('brushworks-diego'), alt: 'Diego Herrera, exterior and prep painter' },
  { id: IMG.priya, url: src('brushworks-priya'), alt: 'Priya Nair, cabinet and finishes painter' },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-painting-residential: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "brushworks": crisp near-white ground, clean-blue primary, warm accent ────
const brushworks = defineTheme({
  name: 'brushworks',
  type: { body: face('Inter', 'sans-serif'), head: face('Outfit', 'sans-serif') },
  shape: { selector: '0.5rem', field: '0.5rem', box: '0.75rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(99% 0.004 240)', // crisp near-white ground
      'oklch(96% 0.008 235)', // cool paper
      'oklch(91% 0.012 235)', // hairline
      'oklch(28% 0.03 250)', // deep slate ink
    ],
    roles: {
      primary: 'oklch(58% 0.14 240)', // clean, bright blue
      secondary: 'oklch(34% 0.025 250)', // dark slate (readable micro-labels on light)
      accent: 'oklch(74% 0.13 62)', // warm amber
      neutral: 'oklch(30% 0.02 250)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(22% 0.02 250)',
      'oklch(18% 0.018 250)',
      'oklch(14% 0.015 250)',
      'oklch(96% 0.005 240)',
    ],
    roles: {
      primary: 'oklch(72% 0.13 240)', // lifted clean blue
      secondary: 'oklch(78% 0.02 250)',
      accent: 'oklch(80% 0.12 64)',
      neutral: 'oklch(80% 0.02 250)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the booking spine (policies, painters + hours, the estimate menu) ─────
const hours = (days: number[], startMinute: number, endMinute: number) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

const SCHEDULING = {
  policies: [
    {
      handle: 'painting-standard',
      name: 'Standard visit',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [1440, 120],
      policyText:
        'Give us at least 24 hours’ notice to move or cancel a visit. We text a reminder the day before and confirm when your painter is on the way.',
    },
  ],
  resources: [
    {
      handle: 'maya',
      name: 'Maya Okonkwo',
      kind: 'staff',
      skillTags: ['interior', 'trim', 'general'],
      windows: hours([1, 2, 3, 4, 5], 480, 1020), // Mon–Fri 8–5
    },
    {
      handle: 'diego',
      name: 'Diego Herrera',
      kind: 'staff',
      skillTags: ['exterior', 'general', 'prep'],
      windows: hours([1, 2, 3, 4, 5, 6], 420, 1020), // Mon–Sat 7–5
    },
    {
      handle: 'priya',
      name: 'Priya Nair',
      kind: 'staff',
      skillTags: ['cabinets', 'interior', 'general'],
      windows: hours([2, 3, 4, 5, 6], 540, 1080), // Tue–Sat 9–6
    },
  ],
  services: [
    {
      handle: 'free-estimate',
      name: 'Free estimate',
      description:
        'We walk the space, talk through your colors and finishes, and give you a clear written price — no charge, no pressure.',
      durationMinutes: 45,
      priceCents: 0,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'painter', kind: 'staff', skillTags: ['general'], count: 1 },
      ],
      policyHandle: 'painting-standard',
    },
    {
      handle: 'interior-painting-estimate',
      name: 'Interior painting estimate',
      description:
        'A room, a floor or the whole inside — we measure, check the prep and quote a flat, written price for the job.',
      durationMinutes: 45,
      priceCents: 0,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'painter', kind: 'staff', skillTags: ['general'], count: 1 },
      ],
      policyHandle: 'painting-standard',
    },
    {
      handle: 'exterior-painting-estimate',
      name: 'Exterior painting estimate',
      description:
        'Siding, trim, doors and eaves — we look at the surfaces and weather wear and give you a straight price to repaint.',
      durationMinutes: 60,
      priceCents: 0,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'painter', kind: 'staff', skillTags: ['general'], count: 1 },
      ],
      policyHandle: 'painting-standard',
    },
    {
      handle: 'cabinet-refinishing-consult',
      name: 'Cabinet refinishing consult',
      description:
        'A sit-down about your kitchen cabinets — color, finish and how we prep and spray for a factory-smooth result.',
      durationMinutes: 45,
      priceCents: 0,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'painter', kind: 'staff', skillTags: ['cabinets'], count: 1 },
      ],
      policyHandle: 'painting-standard',
    },
    {
      handle: 'color-consultation',
      name: 'Color consultation',
      description:
        'Stuck between swatches? We bring samples, look at your light, and help you land on colors you’ll love for years.',
      durationMinutes: 30,
      priceCents: 0,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'painter', kind: 'staff', skillTags: ['general'], count: 1 },
      ],
      policyHandle: 'painting-standard',
    },
    {
      handle: 'drywall-repair-visit',
      name: 'Drywall repair visit',
      description:
        'Cracks, dents, water stains or nail pops patched, sanded and blended smooth so the new paint sits flawless.',
      durationMinutes: 90,
      priceCents: 12900,
      bufferAfterMin: 15,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'painter', kind: 'staff', skillTags: ['general'], count: 1 },
      ],
      policyHandle: 'painting-standard',
    },
    {
      handle: 'trim-accent-estimate',
      name: 'Trim & accent estimate',
      description:
        'Baseboards, crown, doors or a single feature wall — we quote the detail work that makes a room feel finished.',
      durationMinutes: 30,
      priceCents: 0,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'painter', kind: 'staff', skillTags: ['general'], count: 1 },
      ],
      policyHandle: 'painting-standard',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  photoHero({
    image: url(IMG.hero),
    alt: 'A freshly painted, sunlit living room with crisp white trim',
    title: 'A fresh coat, done right and clean',
    sub: 'Interior and exterior painting from a crew that shows up on time, protects your home and leaves it spotless. Book a free estimate online and get a clear written price.',
    primary: { label: 'Book a free estimate', href: '/book' },
    secondary: { label: 'See our services', href: '/book' },
    overlay: 'dark',
  }),
  featureRow({
    items: [
      {
        title: 'Tidy, respectful crews',
        body: 'Drop cloths, taped edges and shoe covers. We move your things carefully, clean up every day, and you’d never know we were there — except for the paint.',
      },
      {
        title: 'Premium paints only',
        body: 'We paint with top-tier, low-odor paints that cover better and last longer. No thin coats, no cheap substitutes — the finish holds up for years.',
      },
      {
        title: 'Satisfaction guaranteed',
        body: 'We don’t pack up until you’ve walked every room and you’re happy. If a line isn’t crisp or a spot needs another pass, we fix it on the spot.',
      },
      {
        title: 'On time, on budget',
        body: 'You get a real start date and a flat written price up front. We finish when we say we will, for what we quoted — no creeping costs at the end.',
      },
    ],
  }),
  serviceMenu({
    heading: 'What we come out for',
    intro: 'The visits we book most. Pick one to see how long it takes and grab the next open time — most estimates are free.',
    surface: 'muted',
    columns: 2,
    items: [
      {
        name: 'Free estimate',
        priceCents: 0,
        durationMin: 45,
        desc: 'A walk-through and a clear written price, no charge.',
      },
      {
        name: 'Interior painting estimate',
        priceCents: 0,
        durationMin: 45,
        desc: 'A room, a floor or the whole inside, quoted flat.',
      },
      {
        name: 'Exterior painting estimate',
        priceCents: 0,
        durationMin: 60,
        desc: 'Siding, trim and doors, priced to repaint.',
      },
      {
        name: 'Cabinet refinishing consult',
        priceCents: 0,
        durationMin: 45,
        desc: 'A factory-smooth kitchen refresh, planned out.',
      },
    ],
    cta: { label: 'See everything & book', href: '/book' },
  }),
  splitFeature({
    image: url(IMG.story),
    alt: 'A painter cutting a clean line along the ceiling with a brush',
    heading: 'The clean process behind every job',
    body: [
      'Great paint is mostly great prep. We patch, sand, caulk and prime before a single finish coat goes on — that’s why our lines stay crisp and our walls stay smooth.',
      'Then we protect everything that isn’t getting painted, keep a tidy site the whole way through, and do a final walk with you room by room before we call it done.',
    ],
    cta: { label: 'Book your free estimate', href: '/book' },
  }),
  teamRow({
    heading: 'The crew who’ll be at your door',
    intro: 'The same familiar faces every visit — skilled painters who care about the details and treat your home like their own.',
    members: [
      {
        name: 'Maya Okonkwo',
        role: 'Interior & trim lead',
        image: url(IMG.maya),
        alt: 'Maya Okonkwo, interior and trim lead',
        bio: 'Twelve years of clean lines and smooth walls. Maya runs interior jobs and has an eye for trim most people miss.',
      },
      {
        name: 'Diego Herrera',
        role: 'Exterior & prep painter',
        image: url(IMG.diego),
        alt: 'Diego Herrera, exterior and prep painter',
        bio: 'Siding, decks and weather-worn trim. Diego does the prep right so an exterior coat lasts season after season.',
      },
      {
        name: 'Priya Nair',
        role: 'Cabinet & finishes painter',
        image: url(IMG.priya),
        alt: 'Priya Nair, cabinet and finishes painter',
        bio: 'Cabinets, doors and fine finish work. Priya sprays a factory-smooth surface that makes a whole kitchen feel new.',
      },
    ],
  }),
  testimonial({
    quote: 'They repainted our whole downstairs and I keep looking for something to nitpick — there’s nothing. Crisp lines, spotless floors, done on the day they promised. We’ve already booked the exterior.',
    attribution: 'Rachel T., Maplewood homeowner',
  }),
  bookingCta({
    title: 'Ready for a fresh coat?',
    sub: 'Book a free estimate online in about a minute. Pick a day, and we’ll confirm your window and bring the color samples.',
    cta: { label: 'Book a free estimate', href: '/book' },
  }),
];

const BOOK_INTRO = [
  photoHero({
    image: url(IMG.story),
    alt: 'A painter cutting a clean line along the ceiling with a brush',
    title: 'Book a free estimate',
    sub: 'Choose the visit you need to see how long it takes and the next open time — then pick your painter and day. Most estimates are free.',
    primary: { label: 'See services below', href: '/book' },
    overlay: 'darker',
    align: 'start',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.hero),
    alt: 'A freshly painted, sunlit living room with crisp white trim',
    heading: 'About Brushworks Painting',
    body: [
      'We started Brushworks to do painting the way homeowners actually want it — a crew that arrives on time, protects your home, quotes an honest flat price, and leaves the place cleaner than they found it.',
      'We’re a small, local team painting homes across the area. No sales pressure, no thin coats, no mess left behind. Just careful prep, premium paint and a finish you’ll be glad to look at every day.',
    ],
    cta: { label: 'Book a free estimate', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'How we work',
    items: [
      {
        title: 'Prep before paint',
        body: 'We patch, sand, caulk and prime first, and mask off everything that stays. Ninety percent of a lasting finish is the work you never see.',
      },
      {
        title: 'Clean, careful, covered',
        body: 'Drop cloths, taped edges and daily clean-up. Furniture gets moved and covered, floors stay protected, and old cans get hauled away.',
      },
      {
        title: 'A final walk, together',
        body: 'Before we pack up, we walk every room with you in good light. If anything needs another pass, it gets one — that’s the guarantee.',
      },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Where we work & how to reach us',
    address: ['Brushworks Painting', '218 Cedar Mill Road', 'Maplewood, NJ 07040'],
    mapLocation: '218 Cedar Mill Road, Maplewood, NJ 07040',
    hours: [
      { day: 'Monday – Friday', time: '7:00 – 5:00' },
      { day: 'Saturday', time: '9:00 – 4:00' },
      { day: 'Sunday', time: 'Closed' },
      { day: 'Estimates', time: 'Booked online, free' },
    ],
  }),
  bookingCta({
    title: 'Rather book than call?',
    sub: 'See the next open times and reserve your free estimate online — no phone tag, no waiting on hold.',
    surface: 'muted',
    cta: { label: 'Book a free estimate', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-painting-residential',
  name: 'sparx — Painting (Residential)',
  summary:
    'A clean, reliable residential-painting site — a fresh near-white palette with a clean-blue primary and warm accent, photo-led throughout. Installs a working online booking flow: homeowners book a free estimate or consult and get a real time slot. Ships a full visit menu (free, interior, exterior, cabinet, color, drywall, trim), three painters as dispatchable staff with their own hours, and a standard visit policy. Ships as "Brushworks Painting".',
  tagline: 'A fresh, reliable template for residential painters — book free estimates online from day one.',
  industry: 'Painting',
  sortWeight: 26,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: {
    businessName: 'Brushworks Painting',
    tagline: 'A fresh coat, done right and clean.',
  },
  theme: brushworks,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Brushworks Painting — clean, reliable residential painters',
      description:
        'Brushworks is a local residential painting company — interior, exterior, cabinets and trim, done tidy and on time. Book a free estimate online.',
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
