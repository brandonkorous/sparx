// sparx-junk-eco — "Green Haul", an ECO / DONATION-FIRST junk removal & hauling service.
//
// The conscientious, community-minded end of the hauling lane — donation-first, recycling
// and responsible disposal, e-waste, cleanouts, minimal landfill. An earthy palette (a
// forest/sage-green primary, a warm clay accent, a soft cream ground, a dark green-charcoal
// ink), a refined humanist-serif display over a humanist sans, and calm, uncluttered
// photography. Deliberately the OPPOSITE of the fast, friendly everyday-junk sibling — same
// booking spine, a quieter, greener, keep-it-out-of-the-landfill business whose functional
// core is booking a free quote / pickup.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-junk-eco.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-junk-eco/**" \
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
  hero: 'junk-eco-hero',
  donation: 'junk-eco-donation',
  divert: 'junk-eco-divert',
  space: 'junk-eco-space',
  rowan: 'junk-eco-rowan',
  sena: 'junk-eco-sena',
  malik: 'junk-eco-malik',
} as const;

const PHOTO: Record<string, string> = {
  "greenhaul-hero": "https://images.unsplash.com/photo-1778864874969-16e2432b2709?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZG9uYXRpb24lMjBib3hlcyUyMGNoYXJpdHl8ZW58MHwwfHx8MTc4NjM5NTcxN3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "greenhaul-donation": "https://images.unsplash.com/photo-1604187351574-c75ca79f5807?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cmVjeWNsaW5nJTIwc29ydGluZ3xlbnwwfDB8fHwxNzg2Mzk1NzIwfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "greenhaul-divert": "https://images.unsplash.com/photo-1653406384710-08688ec6b979?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cmVjeWNsaW5nJTIwY2VudGVyfGVufDB8MHx8fDE3ODYzOTU3MjN8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "greenhaul-space": "https://images.unsplash.com/photo-1582479429421-321775166674?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2xlYW4lMjB0aWR5JTIwcm9vbXxlbnwwfDB8fHwxNzg2Mzk1NzI2fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "greenhaul-rowan": "https://images.unsplash.com/photo-1530983822321-fcac2d3c0f06?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29ya2VyJTIwcG9ydHJhaXQlMjBtYW58ZW58MHwwfHx8MTc4NjM5NTcxMHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "greenhaul-sena": "https://images.unsplash.com/photo-1615464670798-6e92fafa2a89?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjB3b3JrZXIlMjBwb3J0cmFpdHxlbnwwfDB8fHwxNzg2Mzg4MjQwfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "greenhaul-malik": "https://images.unsplash.com/photo-1759521296144-fe6f2d2dc769?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29ya2VyJTIwcG9ydHJhaXQlMjB1bmlmb3JtfGVufDB8MHx8fDE3ODYzODkyNjJ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
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
    url: src('greenhaul-hero'),
    alt: 'A cleared, sunlit room with neatly stacked donation boxes ready for pickup',
  },
  {
    id: IMG.donation,
    url: src('greenhaul-donation'),
    alt: 'Cardboard boxes of clothing and household goods labelled for donation',
  },
  {
    id: IMG.divert,
    url: src('greenhaul-divert'),
    alt: 'Sorted piles of furniture, electronics and recycling separated for reuse',
  },
  {
    id: IMG.space,
    url: src('greenhaul-space'),
    alt: 'An emptied garage with clear floor space after a cleanout',
  },
  { id: IMG.rowan, url: src('greenhaul-rowan'), alt: 'Rowan Ellis, lead hauler' },
  { id: IMG.sena, url: src('greenhaul-sena'), alt: 'Sena Adeyemi, recycling & e-waste lead' },
  { id: IMG.malik, url: src('greenhaul-malik'), alt: 'Malik Torres, cleanout specialist' },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-junk-eco: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "greenhaul": soft cream ground, forest-green primary, warm-clay accent, serif ─
const greenhaul = defineTheme({
  name: 'greenhaul',
  type: { body: face('Inter', 'sans-serif'), head: face('Fraunces', 'serif') },
  shape: { selector: '0.5rem', field: '0.5rem', box: '0.75rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(97% 0.014 110)', // soft cream ground
      'oklch(93% 0.018 118)', // warm oat
      'oklch(88% 0.02 128)', // sage hairline
      'oklch(27% 0.03 155)', // deep forest ink
    ],
    roles: {
      primary: 'oklch(50% 0.1 155)', // forest / sage green
      secondary: 'oklch(35% 0.03 155)', // deep green-charcoal (micro-labels stay readable)
      accent: 'oklch(64% 0.09 60)', // warm clay
      neutral: 'oklch(29% 0.025 155)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(23% 0.025 155)',
      'oklch(19% 0.02 155)',
      'oklch(15% 0.015 155)',
      'oklch(95% 0.014 110)',
    ],
    roles: {
      primary: 'oklch(70% 0.11 155)',
      secondary: 'oklch(80% 0.025 125)',
      accent: 'oklch(74% 0.09 60)',
      neutral: 'oklch(84% 0.02 125)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the booking spine (policies, crews + hours, the pickup/quote menu) ────
const hours = (days: number[], startMinute: number, endMinute: number) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

const SCHEDULING = {
  policies: [
    {
      handle: 'haul-standard',
      name: 'Standard booking',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [1440, 120],
      policyText:
        'Please give us at least 24 hours’ notice to move or cancel a pickup. We send a reminder the day before and two hours ahead, and we’ll always text you a heads-up when the crew is on the way.',
    },
    {
      handle: 'same-day-priority',
      name: 'Same-day priority',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [120],
      policyText:
        'Same-day pickups are booked into the next open crew window and confirmed by text. If plans change, let us know as soon as you can so we can offer the slot to someone else.',
    },
  ],
  resources: [
    {
      handle: 'rowan-crew',
      name: 'Rowan’s crew',
      kind: 'staff',
      skillTags: ['pickup', 'donation', 'general'],
      windows: hours([1, 2, 3, 4, 5, 6], 480, 1020), // Mon–Sat 8–5
    },
    {
      handle: 'sena-crew',
      name: 'Sena’s crew',
      kind: 'staff',
      skillTags: ['recycling', 'ewaste', 'general'],
      windows: hours([2, 3, 4, 5, 6], 480, 1020), // Tue–Sat 8–5
    },
    {
      handle: 'malik-crew',
      name: 'Malik’s crew',
      kind: 'staff',
      skillTags: ['cleanout', 'donation', 'general'],
      windows: hours([1, 2, 3, 4, 5], 540, 1080), // Mon–Fri 9–6
    },
  ],
  services: [
    {
      handle: 'free-quote',
      name: 'Free pickup quote',
      description:
        'A free, no-pressure look — in person or by photo — at what you need gone. We’ll tell you what can be donated, what we can recycle, and give you a flat, upfront price before anything moves.',
      durationMinutes: 30,
      priceCents: 0,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'crew', kind: 'staff', skillTags: ['general'], count: 1 }],
      policyHandle: 'haul-standard',
    },
    {
      handle: 'donation-pickup',
      name: 'Donation pickup',
      description:
        'Gently-used furniture, clothing, housewares and more, collected and driven straight to local charities and shelters. Still good? It gets a second home, not a dumpster — and you get the donation receipt.',
      durationMinutes: 60,
      priceCents: 6000,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'crew', kind: 'staff', skillTags: ['general'], count: 1 }],
      policyHandle: 'haul-standard',
    },
    {
      handle: 'recycling-haul',
      name: 'Recycling haul',
      description:
        'Metal, cardboard, wood, appliances and mixed materials sorted and taken to the right recycler — not the landfill. We break it down, separate it, and divert as much as the facilities near you will take.',
      durationMinutes: 90,
      priceCents: 8500,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'crew', kind: 'staff', skillTags: ['general'], count: 1 }],
      policyHandle: 'haul-standard',
    },
    {
      handle: 'ewaste-removal',
      name: 'E-waste removal',
      description:
        'Old computers, TVs, monitors, cables and batteries handled by our certified e-waste crew and taken to a responsible processor — data-bearing drives noted, nothing dumped or shipped offshore.',
      durationMinutes: 60,
      priceCents: 7500,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'crew', kind: 'staff', skillTags: ['ewaste'], count: 1 }],
      policyHandle: 'haul-standard',
    },
    {
      handle: 'furniture-removal',
      name: 'Furniture removal',
      description:
        'Couches, mattresses, desks and the heavy things you can’t lift alone — carried out for you, then donated if they’re usable and recycled if they’re not. No stairs, no problem.',
      durationMinutes: 90,
      priceCents: 9500,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'crew', kind: 'staff', skillTags: ['general'], count: 1 }],
      policyHandle: 'haul-standard',
    },
    {
      handle: 'cleanout-consult',
      name: 'Cleanout consult',
      description:
        'Planning a garage, estate, office or whole-home clearout? A free walkthrough to scope the job, sort what can be saved from what can’t, and map out a donation-first plan with a clear, flat quote.',
      durationMinutes: 45,
      priceCents: 0,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'crew', kind: 'staff', skillTags: ['general'], count: 1 }],
      policyHandle: 'haul-standard',
    },
    {
      handle: 'same-day-pickup',
      name: 'Same-day pickup',
      description:
        'Need it gone today? When a crew has an open window, we’ll come the same day — same donation-first, minimal-landfill promise, just faster. Book it and we’ll confirm your slot by text.',
      durationMinutes: 120,
      priceCents: 14000,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'crew', kind: 'staff', skillTags: ['general'], count: 1 }],
      policyHandle: 'same-day-priority',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  photoHero({
    image: url(IMG.hero),
    alt: 'A cleared, sunlit room with neatly stacked donation boxes ready for pickup',
    title: 'Haul it away. Keep it out of the landfill.',
    sub: 'Donation-first junk removal for homes and small businesses — we sort, donate, recycle and responsibly dispose, so most of what leaves your place never sees a dump.',
    primary: { label: 'Book a pickup', href: '/book' },
    secondary: { label: 'Get a free quote', href: '/book' },
    overlay: 'dark',
  }),
  featureRow({
    items: [
      {
        title: 'Donation-first, always',
        body: 'Anything still usable goes to local charities and shelters before it’s ever called trash — and you get the donation receipt for it.',
      },
      {
        title: 'We recycle & divert',
        body: 'Metal, wood, cardboard and appliances are sorted and sent to the right recycler. Most of every load stays out of the landfill.',
      },
      {
        title: 'Responsible e-waste',
        body: 'Old electronics and batteries go to certified processors — never dumped, never shipped offshore, data-bearing drives noted first.',
      },
      {
        title: 'Transparent pricing',
        body: 'A flat, upfront price after a free quote — by the load, not by the surprise. You know the number before anything moves.',
      },
    ],
  }),
  serviceMenu({
    heading: 'Ways we haul',
    intro: 'A few of the pickups we do most. Every one starts with a free quote and follows the same donate-first, recycle-next promise. Full prices and live availability are on the booking page.',
    surface: 'muted',
    columns: 2,
    items: [
      {
        name: 'Donation pickup',
        priceCents: 6000,
        durationMin: 60,
        desc: 'Usable goods collected and driven to local charities.',
      },
      {
        name: 'Recycling haul',
        priceCents: 8500,
        durationMin: 90,
        desc: 'Sorted and diverted to the right recycler, not the dump.',
      },
      {
        name: 'E-waste removal',
        priceCents: 7500,
        durationMin: 60,
        desc: 'Electronics handled by a certified, responsible processor.',
      },
      {
        name: 'Furniture removal',
        priceCents: 9500,
        durationMin: 90,
        desc: 'The heavy things carried out, then donated or recycled.',
      },
    ],
    cta: { label: 'See everything & book', href: '/book' },
  }),
  splitFeature({
    image: url(IMG.divert),
    alt: 'Sorted piles of furniture, electronics and recycling separated for reuse',
    heading: 'Donate, recycle, divert — dump last',
    body: [
      'Most hauling ends the same way: one truck, one trip, straight to the landfill. We work the other direction. Every load gets sorted first — what’s still good is donated, what can be recycled is separated out, and only what’s truly finished is disposed of.',
      'It takes a little longer at the curb, and it’s the whole point. On a typical job the great majority of what we take never becomes trash — it becomes someone else’s couch, or a bale of clean metal, instead of another cubic yard buried.',
    ],
    cta: { label: 'Book a pickup', href: '/book' },
  }),
  teamRow({
    heading: 'The crew that shows up',
    intro: 'Real people who’ll treat your place with care — and sort every load like it matters, because it does.',
    members: [
      {
        name: 'Rowan Ellis',
        role: 'Lead hauler',
        image: url(IMG.rowan),
        alt: 'Rowan Ellis, lead hauler',
        bio: 'Rowan runs the donation runs and knows every charity and drop-off within a county of here.',
      },
      {
        name: 'Sena Adeyemi',
        role: 'Recycling & e-waste lead',
        image: url(IMG.sena),
        alt: 'Sena Adeyemi, recycling & e-waste lead',
        bio: 'Sena handles the sorting and the certified processors — the reason so little of a load ends up buried.',
      },
      {
        name: 'Malik Torres',
        role: 'Cleanout specialist',
        image: url(IMG.malik),
        alt: 'Malik Torres, cleanout specialist',
        bio: 'Malik takes on the big garage, estate and office clearouts — calm, careful, and quick on the heavy stuff.',
      },
    ],
  }),
  testimonial({
    quote:
      'We cleared out my mom’s house after she moved, and I dreaded it. Green Haul turned it into something I felt good about — three carloads went to a women’s shelter, the old electronics were handled properly, and barely anything went to the dump. They made a hard week easier.',
    attribution: 'Priya, Green Haul customer',
    surface: 'muted',
  }),
  bookingCta({
    title: 'Ready to clear it out the right way?',
    sub: 'Book a pickup, or start with a free quote. It takes about a minute, and we’ll tell you exactly what happens to everything we take.',
    cta: { label: 'Book a pickup', href: '/book' },
  }),
];

const BOOK_INTRO = [
  photoHero({
    image: url(IMG.donation),
    alt: 'Cardboard boxes of clothing and household goods labelled for donation',
    title: 'Book your pickup',
    sub: 'Choose a service to see prices and live availability, then pick a crew and a time that suits you. Not sure what you’ve got? Start with a free quote.',
    primary: { label: 'See pickups below', href: '/book' },
    overlay: 'darker',
    align: 'start',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.space),
    alt: 'An emptied garage with clear floor space after a cleanout',
    heading: 'About Green Haul',
    body: [
      'Green Haul started with a simple gripe: clearing out a home or a business almost always meant sending a full truck straight to the landfill, usable furniture and all. It felt wasteful because it was.',
      'So we built a hauling company around a different order of operations — donate what’s still good, recycle what can be recycled, and only dump what’s genuinely finished. Same easy pickup, far less buried. It’s better for your town, and it’s the kind of work we’re proud to load onto the truck.',
    ],
    cta: { label: 'Book a pickup', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'How we work',
    items: [
      {
        title: 'Sort before we dump',
        body: 'Every load gets separated on site — donations, recycling, e-waste and disposal — so the landfill is the last resort, never the default.',
      },
      {
        title: 'Local charities first',
        body: 'Usable goods go to shelters, thrifts and reuse centres near you, and you get the receipt. Your clutter becomes someone’s fresh start.',
      },
      {
        title: 'Honest, flat pricing',
        body: 'A free quote, then one clear price by the load. No hourly meter running, no add-ons at the curb — you know the number before we lift a thing.',
      },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Reach Green Haul',
    address: ['Green Haul', '212 Cedar Yard', 'Bay 4 · Portland, OR 97217'],
    mapLocation: '212 Cedar Yard, Portland, OR 97217',
    hours: [
      { day: 'Monday – Friday', time: '8:00 – 6:00' },
      { day: 'Saturday', time: '8:00 – 5:00' },
      { day: 'Sunday', time: 'Closed' },
    ],
  }),
  bookingCta({
    title: 'Rather book than call?',
    sub: 'See live availability and reserve your pickup online — no phone tag, no quote forms to chase.',
    surface: 'muted',
    cta: { label: 'Book a pickup', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-junk-eco',
  name: 'sparx — Junk Removal (Eco)',
  summary:
    'A natural palette and online booking for an eco, donation-first junk removal and hauling service — free quotes and pickups booked online, three crews as dispatchable resources with their own hours, and a donate-recycle-divert promise that keeps most of every load out of the landfill. Ships as "Green Haul", a conscientious, community-minded hauler.',
  tagline: 'A natural, donation-first template for eco junk removal — book pickups online from day one.',
  industry: 'Junk removal',
  sortWeight: 9,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'Green Haul', tagline: 'Hauled away, not buried.' },
  theme: greenhaul,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Green Haul — eco, donation-first junk removal',
      description:
        'Green Haul is a donation-first junk removal and hauling service — we donate, recycle and responsibly dispose so most of every load stays out of the landfill. Book a pickup or a free quote online.',
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
