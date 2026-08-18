// sparx-moving-premium — "Whiteglove Movers", a premium white-glove & long-distance mover.
//
// The refined, concierge sibling of the moving lane: a deep charcoal-ink primary, a warm
// brass accent, a soft greige/ivory ground, an elegant serif display over a humanist sans,
// and calm, careful relocation photography carrying the page. This is the PREMIUM,
// long-distance-and-white-glove sibling — interstate moves, full-service packing, fine-art
// and antiques, corporate and executive relocation, and storage — deliberately distinct
// from the bright, friendly LOCAL-mover template: same booking spine, a different business.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @wizeworks/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-moving-premium.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-moving-premium/**" \
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
  hero: 'moving-premium-hero',
  process: 'moving-premium-process',
  about: 'moving-premium-about',
  marcus: 'moving-premium-marcus',
  celine: 'moving-premium-celine',
  jonah: 'moving-premium-jonah',
} as const;

// Empty by design: every image resolves through the picsum `src()` fallback below, so the
// bundle references stable, license-free placeholders until the tenant swaps in their own.
const PHOTO: Record<string, string> = {
  "whiteglove-hero": "https://images.unsplash.com/photo-1581573950452-5a438c5f390f?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZWxlZ2FudCUyMGhvbWUlMjBtb3Zpbmd8ZW58MHwwfHx8MTc4NjM5NTIwNnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "whiteglove-process": "https://images.unsplash.com/photo-1656543802898-41c8c46683a7?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2FyZWZ1bCUyMHBhY2tpbmclMjBib3hlc3xlbnwwfDB8fHwxNzg2Mzk1MjA5fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "whiteglove-about": "https://images.unsplash.com/photo-1714647211902-bb711d643a17?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bW92aW5nJTIwc2VydmljZSUyMHByb2Zlc3Npb25hbHxlbnwwfDB8fHwxNzg2Mzk1MjExfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "whiteglove-marcus": "https://images.unsplash.com/photo-1676989880361-091e12efc056?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cHJvZmVzc2lvbmFsJTIwbWFuJTIwcG9ydHJhaXR8ZW58MHwwfHx8MTc4NjM4NzQxMHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "whiteglove-celine": "https://images.unsplash.com/photo-1637589267610-6c66fc2a086b?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YnVzaW5lc3N3b21hbiUyMHBvcnRyYWl0fGVufDB8MHx8fDE3ODYzOTUyMTZ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "whiteglove-jonah": "https://images.unsplash.com/photo-1676989880361-091e12efc056?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bWFuYWdlciUyMHBvcnRyYWl0JTIwbWFufGVufDB8MHx8fDE3ODYzOTUyMTl8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (seed: string): string =>
  PHOTO[seed] ?? `https://picsum.photos/seed/${seed}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}
const ASSETS: Asset[] = [
  { id: IMG.hero, url: src('whiteglove-hero'), alt: 'An elegant home at dusk with movers carrying wrapped furniture with care' },
  { id: IMG.process, url: src('whiteglove-process'), alt: 'A packer wrapping a framed artwork in protective material on a padded table' },
  { id: IMG.about, url: src('whiteglove-about'), alt: 'A calm, orderly moving van interior with blanket-wrapped pieces neatly secured' },
  { id: IMG.marcus, url: src('whiteglove-marcus'), alt: 'Marcus Bell, senior move manager' },
  { id: IMG.celine, url: src('whiteglove-celine'), alt: 'Céline Ordóñez, fine-art and antiques manager' },
  { id: IMG.jonah, url: src('whiteglove-jonah'), alt: 'Jonah Reyes, corporate relocation manager' },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-moving-premium: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "whiteglove": greige-ivory ground, deep ink primary, warm brass accent ──────
const whiteglove = defineTheme({
  name: 'whiteglove',
  type: { body: face('Inter', 'sans-serif'), head: face('Fraunces', 'serif') },
  shape: { selector: '0.1875rem', field: '0.1875rem', box: '0.25rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(96% 0.005 95)', // warm greige-ivory ground
      'oklch(92% 0.007 92)', // oat
      'oklch(87% 0.009 90)', // hairline
      'oklch(22% 0.02 255)', // deep ink
    ],
    roles: {
      primary: 'oklch(26% 0.03 255)', // deep charcoal navy-ink
      secondary: 'oklch(36% 0.02 255)', // dark slate — readable micro-labels on light
      accent: 'oklch(66% 0.09 74)', // warm brass / gold
      neutral: 'oklch(24% 0.02 255)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(20% 0.018 255)',
      'oklch(16% 0.014 255)',
      'oklch(13% 0.01 255)',
      'oklch(93% 0.006 95)',
    ],
    roles: {
      primary: 'oklch(88% 0.02 90)', // warm ivory — a light fill on the dark ground
      secondary: 'oklch(80% 0.015 90)',
      accent: 'oklch(78% 0.085 76)',
      neutral: 'oklch(86% 0.012 90)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the booking spine (policies, move managers + hours, the consult menu) ──
const hours = (days: number[], startMinute: number, endMinute: number) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

const SCHEDULING = {
  policies: [
    {
      handle: 'whiteglove-standard',
      name: 'Standard booking',
      depositType: 'none',
      cancellationWindowHours: 48,
      reminderOffsetsMin: [2880, 120],
      policyText:
        'Please give us at least 48 hours’ notice to change or cancel your consultation. We send a reminder two days before and two hours ahead.',
    },
    {
      handle: 'move-deposit',
      name: 'Move reservation deposit',
      depositType: 'deposit',
      depositAmountCents: 25000,
      cancellationWindowHours: 48,
      reminderOffsetsMin: [2880, 1440, 120],
      policyText:
        'Reserving a move date holds a $250 deposit that is credited in full toward your move. Reschedule with 48 hours’ notice and it carries over to your new date.',
    },
  ],
  resources: [
    {
      handle: 'marcus',
      name: 'Marcus Bell',
      kind: 'staff',
      skillTags: ['long-distance', 'white-glove', 'general'],
      windows: hours([1, 2, 3, 4, 5], 480, 1020), // Mon–Fri 8–5
    },
    {
      handle: 'celine',
      name: 'Céline Ordóñez',
      kind: 'staff',
      skillTags: ['fine-art', 'white-glove', 'general'],
      windows: hours([2, 3, 4, 5, 6], 540, 1080), // Tue–Sat 9–6
    },
    {
      handle: 'jonah',
      name: 'Jonah Reyes',
      kind: 'staff',
      skillTags: ['corporate', 'long-distance', 'general'],
      windows: hours([1, 2, 3, 4, 5], 510, 1050), // Mon–Fri 8:30–5:30
    },
  ],
  services: [
    {
      handle: 'consultation',
      name: 'In-home consultation',
      description:
        'A complimentary walk-through of your home — we take stock of what’s moving, talk timeline and options, and build a precise, honest estimate.',
      durationMinutes: 60,
      priceCents: 0,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'manager', kind: 'staff', skillTags: ['general'], count: 1 },
      ],
      policyHandle: 'whiteglove-standard',
    },
    {
      handle: 'virtual-estimate',
      name: 'Virtual video estimate',
      description:
        'A complimentary video call — walk us through your home on your phone and we’ll prepare a detailed written estimate, no visit required.',
      durationMinutes: 30,
      priceCents: 0,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'manager', kind: 'staff', skillTags: ['general'], count: 1 },
      ],
      policyHandle: 'whiteglove-standard',
    },
    {
      handle: 'long-distance-consult',
      name: 'Long-distance & interstate consultation',
      description:
        'For a cross-country or interstate move — we plan the route, the timeline and the logistics, and assign a dedicated manager for the whole journey.',
      durationMinutes: 60,
      priceCents: 0,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'manager', kind: 'staff', skillTags: ['general'], count: 1 },
      ],
      policyHandle: 'move-deposit',
    },
    {
      handle: 'white-glove-packing-consult',
      name: 'White-glove packing consultation',
      description:
        'Plan full-service, room-by-room packing — every item wrapped, boxed and inventoried by our crew, so you never lift a thing.',
      durationMinutes: 45,
      priceCents: 0,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'manager', kind: 'staff', skillTags: ['general'], count: 1 },
      ],
      policyHandle: 'whiteglove-standard',
    },
    {
      handle: 'fine-art-move-consult',
      name: 'Fine-art & antiques consultation',
      description:
        'For paintings, sculpture, pianos and heirlooms — custom crating, climate care and a specialist manager who handles the irreplaceable.',
      durationMinutes: 60,
      priceCents: 0,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'manager', kind: 'staff', skillTags: ['fine-art'], count: 1 },
      ],
      policyHandle: 'move-deposit',
    },
    {
      handle: 'corporate-relocation-consult',
      name: 'Corporate & executive relocation',
      description:
        'A managed relocation for an executive or a team — coordinated timelines, discreet handling and a single point of contact from start to finish.',
      durationMinutes: 60,
      priceCents: 0,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'manager', kind: 'staff', skillTags: ['corporate'], count: 1 },
      ],
      policyHandle: 'move-deposit',
    },
    {
      handle: 'storage-consult',
      name: 'Storage & warehousing consultation',
      description:
        'Short- or long-term storage between moves — secure, climate-controlled and fully inventoried, with delivery on your schedule.',
      durationMinutes: 30,
      priceCents: 0,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'manager', kind: 'staff', skillTags: ['general'], count: 1 },
      ],
      policyHandle: 'whiteglove-standard',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  photoHero({
    image: url(IMG.hero),
    alt: 'An elegant home at dusk with movers carrying wrapped furniture with care',
    title: 'A move handled like it’s our own home',
    sub: 'Whiteglove Movers is a premium long-distance and white-glove moving company — meticulous packing, fine-art and antiques, corporate relocation and storage, with a dedicated manager on every move. Book a consultation to begin.',
    primary: { label: 'Book a consultation', href: '/book' },
    secondary: { label: 'See our services', href: '/book' },
    overlay: 'darker',
  }),
  featureRow({
    items: [
      {
        title: 'A dedicated move manager',
        body: 'One expert owns your move end to end — the plan, the crew, the timeline. One name, one number, from the first call to the last box.',
      },
      {
        title: 'Full white-glove packing',
        body: 'Our crew wraps, boxes and inventories every item by hand, then unpacks and places it in your new home. You never lift a thing.',
      },
      {
        title: 'Fine art & antiques',
        body: 'Custom crating, climate care and specialist handling for the pieces that can’t be replaced — paintings, pianos, sculpture and heirlooms.',
      },
      {
        title: 'Nationwide & storage',
        body: 'Long-distance and interstate moves coordinated door to door, with secure, climate-controlled storage for whenever your timing needs it.',
      },
    ],
  }),
  serviceMenu({
    heading: 'Ways to begin',
    intro: 'Every move starts with a conversation. Here are a few of the ways in — every consultation and estimate is complimentary, and live availability is on the booking page.',
    surface: 'muted',
    columns: 2,
    items: [
      { name: 'In-home consultation', priceCents: 0, durationMin: 60, desc: 'A complimentary walk-through and a precise, honest estimate.' },
      { name: 'Virtual video estimate', priceCents: 0, durationMin: 30, desc: 'A guided video call and a detailed written estimate — no visit needed.' },
      { name: 'Long-distance & interstate', priceCents: 0, durationMin: 60, desc: 'Route, timeline and logistics for a cross-country move.' },
      { name: 'Fine-art & antiques', priceCents: 0, durationMin: 60, desc: 'Custom crating and specialist handling for the irreplaceable.' },
    ],
    cta: { label: 'See everything & book', href: '/book' },
  }),
  splitFeature({
    image: url(IMG.process),
    alt: 'A packer wrapping a framed artwork in protective material on a padded table',
    heading: 'The white-glove process',
    body: [
      'It begins with a survey — in your home or over video — where your manager takes a full inventory, understands what matters most, and builds a plan and a fixed, honest estimate before anything is booked.',
      'On move day our crew arrives on schedule, packs and protects every item by hand, and transports it under one careful watch. At the other end we unpack, place and reassemble — so you arrive to a home that’s ready, not a wall of boxes.',
    ],
    cta: { label: 'Book a consultation', href: '/book' },
  }),
  teamRow({
    heading: 'Your move managers',
    intro: 'Book by name — the manager you meet is the one who runs your move, start to finish.',
    members: [
      { name: 'Marcus Bell', role: 'Senior move manager', image: url(IMG.marcus), alt: 'Marcus Bell, senior move manager', bio: 'Twenty years of long-distance moves. Marcus plans the complex ones down to the hour.' },
      { name: 'Céline Ordóñez', role: 'Fine-art & antiques manager', image: url(IMG.celine), alt: 'Céline Ordóñez, fine-art and antiques manager', bio: 'Custom crating and museum-grade care for paintings, pianos and heirlooms.' },
      { name: 'Jonah Reyes', role: 'Corporate relocation manager', image: url(IMG.jonah), alt: 'Jonah Reyes, corporate relocation manager', bio: 'Discreet, precisely timed executive and team relocations, coordinated end to end.' },
    ],
  }),
  testimonial({
    quote: 'We moved three states away with a house full of antiques and not a single scratch. Our manager handled everything — we just showed up to a home that was already put together. Genuinely the calmest move of our lives.',
    attribution: 'The Ashford family, whole-home interstate relocation',
  }),
  bookingCta({
    title: 'Ready to plan a worry-free move?',
    sub: 'Start with a complimentary consultation — choose a move manager, see live availability and pick a time that suits you.',
    cta: { label: 'Book a consultation', href: '/book' },
  }),
];

const BOOK_INTRO = [
  photoHero({
    image: url(IMG.process),
    alt: 'A packer wrapping a framed artwork in protective material on a padded table',
    title: 'Book a consultation',
    sub: 'Choose the kind of move you’re planning to see availability, then pick your move manager and a time. Every consultation and estimate is complimentary.',
    primary: { label: 'See consultations below', href: '/book' },
    overlay: 'darker',
    align: 'start',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.about),
    alt: 'A calm, orderly moving van interior with blanket-wrapped pieces neatly secured',
    heading: 'About Whiteglove Movers',
    body: [
      'Whiteglove Movers began with a simple conviction: a move should feel handled, not endured. We take on a limited number of moves at a time, so every family and every executive gets a dedicated manager and the full attention the day deserves.',
      'From a cross-country relocation to a single fragile heirloom, we bring the same care — an honest estimate, a meticulous crew, and a calm hand on every detail from the first survey to the last piece placed.',
    ],
    cta: { label: 'Book a consultation', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'How we work',
    items: [
      { title: 'One manager, start to finish', body: 'You’re never handed off. The manager who surveys your home is the one who runs the move — the plan, the crew and the timeline all in one pair of hands.' },
      { title: 'A fixed, honest estimate', body: 'We survey thoroughly and quote precisely, then hold to it. No day-of surprises, no creeping numbers — just the figure we agreed on.' },
      { title: 'Fully insured, meticulously careful', body: 'Every move is fully insured and every item handled as if it were irreplaceable — because to the family it belongs to, it usually is.' },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Visit our office',
    address: ['Whiteglove Movers', '220 Meridian Way', 'Suite 400 · Seattle, WA 98109'],
    mapLocation: '220 Meridian Way, Seattle, WA 98109',
    hours: [
      { day: 'Monday – Friday', time: '8:00 – 6:00' },
      { day: 'Saturday', time: '9:00 – 4:00' },
      { day: 'Sunday', time: 'Closed' },
    ],
  }),
  bookingCta({
    title: 'Rather book than call?',
    sub: 'See live availability and reserve your complimentary consultation online — no phone tag.',
    surface: 'muted',
    cta: { label: 'Book a consultation', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-moving-premium',
  name: 'Moving (Premium White-Glove)',
  summary:
    'A refined, premium site for a white-glove long-distance moving company — a deep charcoal palette, a warm brass accent and an elegant serif display over calm relocation photography. Installs online booking for complimentary consultations and estimates, three move managers you book by name with their own hours, and a deposit policy to reserve a move date. Ships as "Whiteglove Movers".',
  tagline: 'A premium, white-glove template for moving companies — book consultations online from day one.',
  industry: 'Moving',
  sortWeight: 13,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'Whiteglove Movers', tagline: 'Meticulous moves, worry-free.' },
  theme: whiteglove,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Whiteglove Movers — premium white-glove & long-distance moving',
      description:
        'Whiteglove Movers is a premium moving company for long-distance and interstate moves — white-glove packing, fine-art and antiques, corporate relocation and storage. Book a consultation online.',
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
