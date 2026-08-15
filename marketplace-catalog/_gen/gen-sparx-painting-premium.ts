// sparx-painting-premium — "Heritage Painters", a premium fine-finishes PAINTING studio.
//
// The refined, craftsman sibling of the painting lane: a deep heritage-green ink primary,
// a warm brass/camel accent, a soft greige/ivory ground, an elegant serif display over a
// humanist sans, and soft-lit interior photography carrying the page. This is the PREMIUM,
// portfolio-led sibling — high-end interiors, cabinet refinishing, fine woodwork, specialty
// finishes and historic-home work — deliberately distinct from the bright, photo-led
// everyday-residential template: same booking spine, a different business.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-painting-premium.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-painting-premium/**" \
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
  hero: 'painting-premium-hero',
  process: 'painting-premium-process',
  about: 'painting-premium-about',
  work1: 'painting-premium-work1',
  work2: 'painting-premium-work2',
  work3: 'painting-premium-work3',
  work4: 'painting-premium-work4',
} as const;

const PHOTO: Record<string, string> = {
  "heritage-hero": "https://images.unsplash.com/photo-1666969442529-caa46ad29336?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZWxlZ2FudCUyMHBhaW50ZWQlMjBpbnRlcmlvcnxlbnwwfDB8fHwxNzg2MzkzNzkwfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "heritage-process": "https://images.unsplash.com/photo-1643312918957-9ccb79b08881?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGFpbnRlciUyMGRldGFpbCUyMGJydXNofGVufDB8MHx8fDE3ODYzOTM3OTN8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "heritage-about": "https://images.unsplash.com/photo-1659930087003-2d64e33181f7?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y3JhZnRzbWFuJTIwcGFpbnRpbmclMjB3b29kd29ya3xlbnwwfDB8fHwxNzg2MzkzNzk3fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "heritage-work1": "https://images.unsplash.com/photo-1560185127-1902ccdc5094?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGFpbnRlZCUyMGNhYmluZXRzJTIwa2l0Y2hlbnxlbnwwfDB8fHwxNzg2MzkzODAwfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "heritage-work2": "https://images.unsplash.com/photo-1776763018821-8feeaeeee0a5?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZWxlZ2FudCUyMGludGVyaW9yJTIwcm9vbXxlbnwwfDB8fHwxNzg2MzkzODA0fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "heritage-work3": "https://images.unsplash.com/photo-1597966923267-938fed07d98e?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dHJpbSUyMG1vbGRpbmclMjBwYWludHxlbnwwfDB8fHwxNzg2MzkzODA3fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "heritage-work4": "https://images.unsplash.com/photo-1632829882891-5047ccc421bc?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cmVmaW5lZCUyMGxpdmluZyUyMHJvb20lMjBpbnRlcmlvcnxlbnwwfDB8fHwxNzg2MzkzODEwfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (seed: string): string =>
  PHOTO[seed] ?? `https://picsum.photos/seed/${seed}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}
const ASSETS: Asset[] = [
  { id: IMG.hero, url: src('heritage-hero'), alt: 'A beautifully finished sitting room with hand-painted panelling and soft daylight' },
  { id: IMG.process, url: src('heritage-process'), alt: 'A painter carefully cutting a crisp line along fine trim with a sable brush' },
  { id: IMG.about, url: src('heritage-about'), alt: 'A calm, light-filled room with freshly refinished woodwork and layered neutral tones' },
  { id: IMG.work1, url: src('heritage-work1'), alt: 'A refinished kitchen with hand-painted cabinetry in a deep muted green' },
  { id: IMG.work2, url: src('heritage-work2'), alt: 'A restored staircase and banister with a flawless satin finish' },
  { id: IMG.work3, url: src('heritage-work3'), alt: 'A period drawing room with limewashed walls and gilded detailing' },
  { id: IMG.work4, url: src('heritage-work4'), alt: 'A study with built-in bookcases finished in a warm, hand-rubbed lacquer' },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-painting-premium: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "heritage": greige-ivory ground, deep heritage-green ink primary, brass accent ─
const heritage = defineTheme({
  name: 'heritage',
  type: { body: face('Inter', 'sans-serif'), head: face('Cormorant Garamond', 'serif') },
  shape: { selector: '0.25rem', field: '0.25rem', box: '0.25rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(96% 0.008 95)', // warm greige-ivory
      'oklch(92% 0.01 92)', // oat
      'oklch(87% 0.012 90)', // hairline
      'oklch(26% 0.03 150)', // deep heritage-green ink
    ],
    roles: {
      primary: 'oklch(32% 0.045 152)', // deep heritage green
      secondary: 'oklch(36% 0.02 150)', // dark pine — readable micro-labels on light
      accent: 'oklch(66% 0.085 74)', // warm brass / camel
      neutral: 'oklch(28% 0.02 150)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(22% 0.02 150)',
      'oklch(18% 0.016 150)',
      'oklch(14% 0.012 150)',
      'oklch(93% 0.008 95)',
    ],
    roles: {
      primary: 'oklch(82% 0.06 130)', // warm sage — a light fill on the dark ground
      secondary: 'oklch(78% 0.02 120)',
      accent: 'oklch(76% 0.08 76)',
      neutral: 'oklch(84% 0.015 120)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the booking spine (policies, craftsmen + hours, the consultation menu) ─
const hours = (days: number[], startMinute: number, endMinute: number) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

const SCHEDULING = {
  policies: [
    {
      handle: 'heritage-standard',
      name: 'Standard booking',
      depositType: 'none',
      cancellationWindowHours: 48,
      reminderOffsetsMin: [2880, 120],
      policyText:
        'Please give us at least 48 hours’ notice to change or cancel your consultation. We send a reminder two days before and two hours ahead.',
    },
    {
      handle: 'project-deposit',
      name: 'Project deposit',
      depositType: 'deposit',
      depositAmountCents: 15000,
      cancellationWindowHours: 48,
      reminderOffsetsMin: [2880, 1440, 120],
      policyText:
        'Booked engagements hold a $150 deposit that is credited toward your project. Reschedule with 48 hours’ notice and it carries over.',
    },
  ],
  resources: [
    {
      handle: 'thomas',
      name: 'Thomas Ainsley',
      kind: 'staff',
      skillTags: ['interior', 'finishes', 'general'],
      windows: hours([1, 2, 3, 4, 5], 480, 1020), // Mon–Fri 8–5
    },
    {
      handle: 'marguerite',
      name: 'Marguerite Fell',
      kind: 'staff',
      skillTags: ['cabinets', 'woodwork', 'general'],
      windows: hours([2, 3, 4, 5, 6], 540, 1080), // Tue–Sat 9–6
    },
    {
      handle: 'edmund',
      name: 'Edmund Rourke',
      kind: 'staff',
      skillTags: ['historic', 'finishes', 'general'],
      windows: hours([1, 2, 3, 4, 5], 510, 1050), // Mon–Fri 8:30–5:30
    },
  ],
  services: [
    {
      handle: 'design-consultation',
      name: 'Design consultation',
      description:
        'A complimentary walk-through of your rooms to talk through colour, finish and how we can help.',
      durationMinutes: 45,
      priceCents: 0,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'craftsman', kind: 'staff', skillTags: ['general'], count: 1 },
      ],
      policyHandle: 'heritage-standard',
    },
    {
      handle: 'fine-interior-consult',
      name: 'Fine interior consultation',
      description:
        'A considered plan for a high-end interior — colour, sheen, meticulous prep and a flawless finish.',
      durationMinutes: 60,
      priceCents: 12000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'craftsman', kind: 'staff', skillTags: ['general'], count: 1 },
      ],
      policyHandle: 'project-deposit',
    },
    {
      handle: 'cabinet-refinishing-consult',
      name: 'Cabinet refinishing consultation',
      description:
        'For kitchens and built-ins — we assess the joinery and plan a durable, hand-finished refinish.',
      durationMinutes: 60,
      priceCents: 12000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'craftsman', kind: 'staff', skillTags: ['cabinets'], count: 1 },
      ],
      policyHandle: 'project-deposit',
    },
    {
      handle: 'specialty-finish-consult',
      name: 'Specialty finish consultation',
      description:
        'Limewash, Venetian plaster, metallics and hand-glazing — we plan the technique your room calls for.',
      durationMinutes: 75,
      priceCents: 15000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'craftsman', kind: 'staff', skillTags: ['general'], count: 1 },
      ],
      policyHandle: 'project-deposit',
    },
    {
      handle: 'historic-home-consult',
      name: 'Historic-home consultation',
      description:
        'Period-sensitive work on older homes — careful stripping, repair and finishes true to the era.',
      durationMinutes: 90,
      priceCents: 18000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'craftsman', kind: 'staff', skillTags: ['historic'], count: 1 },
      ],
      policyHandle: 'project-deposit',
    },
    {
      handle: 'woodwork-refinishing-consult',
      name: 'Woodwork refinishing consultation',
      description:
        'Trim, staircases, doors and panelling — stripped, repaired and refinished with a hand-rubbed touch.',
      durationMinutes: 60,
      priceCents: 12000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'craftsman', kind: 'staff', skillTags: ['general'], count: 1 },
      ],
      policyHandle: 'project-deposit',
    },
    {
      handle: 'color-finish-consult',
      name: 'Colour & finish consultation',
      description:
        'An in-home session on palette, sheen and finish — samples on your walls, in your light.',
      durationMinutes: 60,
      priceCents: 10000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'craftsman', kind: 'staff', skillTags: ['general'], count: 1 },
      ],
      policyHandle: 'heritage-standard',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  photoHero({
    image: url(IMG.hero),
    alt: 'A beautifully finished sitting room with hand-painted panelling and soft daylight',
    title: 'Fine finishes, done by hand',
    sub: 'Heritage Painters is a fine-finishes studio for discerning homes — meticulous prep, specialty finishes and cabinet and woodwork refinishing, finished to a craftsman’s standard. Book a consultation to begin.',
    primary: { label: 'Book a consultation', href: '/book' },
    secondary: { label: 'See our work', href: '/book' },
    overlay: 'dark',
  }),
  featureRow({
    items: [
      {
        title: 'Master craftsmen',
        body: 'Seasoned finishers who have spent careers on brush and blade. You get the same steady hands, start to finish — never a rotating crew.',
      },
      {
        title: 'Meticulous preparation',
        body: 'The work you never see is the work that lasts. We fill, sand, caulk and prime with patience, because a flawless finish is built underneath it.',
      },
      {
        title: 'Specialty & fine finishes',
        body: 'Limewash, Venetian plaster, hand-glazing, metallics and hand-rubbed lacquers — techniques most crews don’t offer, done properly.',
      },
      {
        title: 'Historic-home expertise',
        body: 'Older homes ask for a gentler, wiser hand. We strip, repair and refinish with finishes true to the period, protecting what makes them special.',
      },
    ],
  }),
  serviceMenu({
    heading: 'Ways to work with us',
    intro: 'Every project starts with a conversation. Here are a few of the ways in — full prices and live availability are on the booking page.',
    surface: 'muted',
    columns: 2,
    items: [
      { name: 'Design consultation', priceCents: 0, durationMin: 45, desc: 'A complimentary walk-through of your rooms and how we can help.' },
      { name: 'Fine interior consultation', priceCents: 12000, durationMin: 60, desc: 'A considered plan for a high-end interior, finish and all.' },
      { name: 'Cabinet refinishing', priceCents: 12000, durationMin: 60, desc: 'A durable, hand-finished refinish for kitchens and built-ins.' },
      { name: 'Historic-home consultation', priceCents: 18000, durationMin: 90, desc: 'Period-sensitive work true to your home’s era.' },
    ],
    cta: { label: 'See everything & book', href: '/book' },
  }),
  splitFeature({
    image: url(IMG.process),
    alt: 'A painter carefully cutting a crisp line along fine trim with a sable brush',
    heading: 'The craft is in the preparation',
    body: [
      'We begin with a walk-through and a plan — the right primer, the right sheen, the order of work — then the slow, careful part: filling, sanding and caulking until every surface is honest and true, so the colour has something worthy to sit on.',
      'Only then do we finish, coat by unhurried coat, cutting clean lines by hand and leaving rooms that look considered, personal and built to last.',
    ],
    cta: { label: 'Book a consultation', href: '/book' },
  }),
  galleryStrip({
    heading: 'Selected work',
    surface: 'muted',
    columns: 4,
    images: [
      { src: url(IMG.work1), alt: 'A refinished kitchen with hand-painted cabinetry in a deep muted green' },
      { src: url(IMG.work2), alt: 'A restored staircase and banister with a flawless satin finish' },
      { src: url(IMG.work3), alt: 'A period drawing room with limewashed walls and gilded detailing' },
      { src: url(IMG.work4), alt: 'A study with built-in bookcases finished in a warm, hand-rubbed lacquer' },
    ],
  }),
  testimonial({
    quote: 'They treated our 1910 home like it mattered. The prep was obsessive, the finishes are perfect, and every line is dead straight. Worth every minute of the wait.',
    attribution: 'The Merrow family, whole-home refinish',
  }),
  bookingCta({
    title: 'Ready to give your home the finish it deserves?',
    sub: 'Start with a consultation — choose a craftsman, see live availability and pick a time that suits you.',
    cta: { label: 'Book a consultation', href: '/book' },
  }),
];

const BOOK_INTRO = [
  photoHero({
    image: url(IMG.process),
    alt: 'A painter carefully cutting a crisp line along fine trim with a sable brush',
    title: 'Book a consultation',
    sub: 'Choose the kind of consultation that fits your project to see availability, then pick your craftsman and time.',
    primary: { label: 'See consultations below', href: '/book' },
    overlay: 'darker',
    align: 'start',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.about),
    alt: 'A calm, light-filled room with freshly refinished woodwork and layered neutral tones',
    heading: 'About Heritage Painters',
    body: [
      'Heritage Painters began with a simple conviction: fine finishes are earned through patience, not speed. We take on a small number of projects at a time so every surface gets the prep, the care and the steady hand it deserves.',
      'From a single hand-painted room to a whole-home refinish, we bring the same craft — honest advice, meticulous preparation and finishes made to be lived with for years, not repainted in two.',
    ],
    cta: { label: 'Book a consultation', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'How we work',
    items: [
      { title: 'A considered pace', body: 'We take on a handful of projects at once. That’s deliberate — it’s how each room gets the preparation and finishing it needs to last.' },
      { title: 'Honest about the work', body: 'We plan to your home and your budget from the first visit and keep it visible throughout — no creeping numbers, no shortcuts hidden under the paint.' },
      { title: 'Finishes that endure', body: 'The best compliment we get is that our work still looks right years later. We prepare properly and finish patiently, so it does.' },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Visit the workshop',
    address: ['Heritage Painters', '27 Old Mill Road', 'Workshop 4 · Providence, RI 02903'],
    mapLocation: '27 Old Mill Road, Providence, RI 02903',
    hours: [
      { day: 'Monday – Friday', time: '8:00 – 5:00' },
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
  key: 'sparx-painting-premium',
  name: 'Painting (Premium)',
  summary:
    'A refined site for a premium fine-finishes painting studio — a deep heritage-green palette, a warm brass accent and an elegant serif display over soft-lit interiors. Installs a working booking flow: consultation types from a complimentary walk-through to cabinet refinishing, specialty finishes and historic-home work, three craftsmen you book by name with their own hours, and a project-deposit policy. Ships as "Heritage Painters".',
  tagline: 'A refined, craftsman template for fine-finishes painters — book consultations online from day one.',
  industry: 'Painting',
  sortWeight: 25,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'Heritage Painters', tagline: 'Fine finishes, done by hand.' },
  theme: heritage,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Heritage Painters — a fine-finishes painting studio',
      description:
        'Heritage Painters is a premium fine-finishes studio — high-end interiors, cabinet refinishing, fine woodwork, specialty finishes and historic-home work. Book a consultation online.',
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
