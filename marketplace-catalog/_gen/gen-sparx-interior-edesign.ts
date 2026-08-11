// sparx-interior-edesign — "Room & Co.", an approachable INTERIOR DESIGN & e-design studio.
//
// The friendly, accessible online-design lane: flat-fee design packages, room refreshes,
// colour & layout help and shoppable design boards for everyday homeowners — not a
// white-glove trade contract. A bright, welcoming palette (a warm coral primary, a teal
// accent, a crisp warm-white ground), a modern friendly sans, and rounded corners.
// Deliberately the OPPOSITE of the high-end full-service interior template (charcoal,
// serif, editorial) — same booking spine, a visibly different, cheerier business built on
// a HOW-IT-WORKS three-step story and a menu of flat-fee consults.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-interior-edesign.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-interior-edesign/**" \
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
  hero: 'interior-edesign-hero',
  approach: 'interior-edesign-approach',
  rae: 'interior-edesign-rae',
  devon: 'interior-edesign-devon',
  priya: 'interior-edesign-priya',
  room1: 'interior-edesign-room1',
  room2: 'interior-edesign-room2',
  room3: 'interior-edesign-room3',
} as const;

const PHOTO: Record<string, string> = {
  "roomco-hero": "https://images.unsplash.com/photo-1631679706909-1844bbd07221?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YnJpZ2h0JTIwc3R5bGVkJTIwbGl2aW5nJTIwcm9vbXxlbnwwfDB8fHwxNzg2MzkzMTg3fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "roomco-approach": "https://images.unsplash.com/photo-1664638413302-d1ca29ac885b?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8aW50ZXJpb3IlMjBkZXNpZ24lMjBzd2F0Y2hlc3xlbnwwfDB8fHwxNzg2MzkzMTkwfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "roomco-rae": "https://images.unsplash.com/photo-1779405949264-a44d50a14315?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjBpbnRlcmlvciUyMGRlc2lnbmVyJTIwcG9ydHJhaXR8ZW58MHwwfHx8MTc4NjM5MzE5Mnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "roomco-devon": "https://images.unsplash.com/photo-1730991568704-7456621bb75a?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8aW50ZXJpb3IlMjBkZXNpZ25lciUyMHBvcnRyYWl0fGVufDB8MHx8fDE3ODYzOTMxOTZ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "roomco-priya": "https://images.unsplash.com/photo-1654762701727-de6ccd172eb9?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjBkZXNpZ25lciUyMHBvcnRyYWl0fGVufDB8MHx8fDE3ODYzOTMxOTl8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "roomco-room1": "https://images.unsplash.com/photo-1631679706909-1844bbd07221?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y296eSUyMGxpdmluZyUyMHJvb20lMjBkZWNvcnxlbnwwfDB8fHwxNzg2MzkzMjAyfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "roomco-room2": "https://images.unsplash.com/photo-1616486029423-aaa4789e8c9a?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YnJpZ2h0JTIwYmVkcm9vbSUyMGludGVyaW9yfGVufDB8MHx8fDE3ODYzOTMyMDV8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "roomco-room3": "https://images.unsplash.com/photo-1600494603989-9650cf6ddd3d?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8aG9tZSUyMG9mZmljZSUyMGludGVyaW9yfGVufDB8MHx8fDE3ODYzOTMyMDd8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (seed: string): string =>
  PHOTO[seed] ?? `https://picsum.photos/seed/${seed}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}
const ASSETS: Asset[] = [
  { id: IMG.hero, url: src('roomco-hero'), alt: 'A bright, freshly styled living room with plants and warm textiles' },
  { id: IMG.approach, url: src('roomco-approach'), alt: 'A colour-and-fabric moodboard laid out on a sunny table' },
  { id: IMG.rae, url: src('roomco-rae'), alt: 'Rae Whitfield, interior designer' },
  { id: IMG.devon, url: src('roomco-devon'), alt: 'Devon Ellis, interior designer' },
  { id: IMG.priya, url: src('roomco-priya'), alt: 'Priya Nair, interior designer' },
  { id: IMG.room1, url: src('roomco-room1'), alt: 'A cosy reading nook in soft neutrals and coral accents' },
  { id: IMG.room2, url: src('roomco-room2'), alt: 'A cheerful home office with a green desk and gallery wall' },
  { id: IMG.room3, url: src('roomco-room3'), alt: 'A light-filled dining corner with rattan chairs' },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-interior-edesign: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "roomco": warm-white ground, coral primary, teal accent, friendly sans ──────
const roomco = defineTheme({
  name: 'roomco',
  type: { body: face('Inter', 'sans-serif'), head: face('Outfit', 'sans-serif') },
  shape: { selector: '0.75rem', field: '0.625rem', box: '1rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(98% 0.006 80)', // crisp warm white
      'oklch(95% 0.009 75)', // soft cream
      'oklch(90% 0.012 72)', // hairline
      'oklch(28% 0.02 60)', // warm dark ink
    ],
    roles: {
      primary: 'oklch(66% 0.16 32)', // warm coral
      secondary: 'oklch(35% 0.025 250)', // dark slate — readable micro-labels on light
      accent: 'oklch(68% 0.09 195)', // fresh teal
      neutral: 'oklch(30% 0.015 60)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(24% 0.015 258)',
      'oklch(20% 0.012 258)',
      'oklch(16% 0.01 258)',
      'oklch(95% 0.006 80)',
    ],
    roles: {
      primary: 'oklch(73% 0.15 34)',
      secondary: 'oklch(82% 0.02 250)',
      accent: 'oklch(74% 0.09 195)',
      neutral: 'oklch(84% 0.015 70)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the booking spine (policy, designers + hours, the consult menu) ────────
const hours = (days: number[], startMinute: number, endMinute: number) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

const SCHEDULING = {
  policies: [
    {
      handle: 'roomco-standard',
      name: 'Standard booking',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [1440, 120],
      policyText:
        'Need to move your session? Just give us 24 hours’ notice and we’ll happily reschedule. We send a reminder the day before and two hours ahead.',
    },
  ],
  resources: [
    {
      handle: 'rae',
      name: 'Rae Whitfield',
      kind: 'staff',
      skillTags: ['edesign', 'color', 'styling'],
      windows: hours([1, 2, 3, 4, 5], 540, 1020), // Mon–Fri 9–5
    },
    {
      handle: 'devon',
      name: 'Devon Ellis',
      kind: 'staff',
      skillTags: ['edesign', 'layout', 'styling'],
      windows: hours([2, 3, 4, 5, 6], 600, 1080), // Tue–Sat 10–6
    },
    {
      handle: 'priya',
      name: 'Priya Nair',
      kind: 'staff',
      skillTags: ['edesign', 'refresh', 'color'],
      windows: hours([1, 3, 4, 5], 600, 1140), // Mon, Wed–Fri 10–7
    },
  ],
  services: [
    {
      handle: 'free-consult',
      name: 'Free discovery consult',
      description:
        'A friendly 30-minute video call to talk through your room, your style and what’s possible — no cost, no pressure.',
      durationMinutes: 30,
      priceCents: 0,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'designer', kind: 'staff', skillTags: ['edesign'], count: 1 }],
      policyHandle: 'roomco-standard',
    },
    {
      handle: 'single-room-edesign',
      name: 'Single-room e-design',
      description:
        'A complete online design for one room — a shoppable design board, layout plan and a shopping list you can buy at your own pace.',
      durationMinutes: 60,
      priceCents: 29900,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'designer', kind: 'staff', skillTags: ['edesign'], count: 1 }],
      policyHandle: 'roomco-standard',
    },
    {
      handle: 'color-consult',
      name: 'Colour consult',
      description:
        'Stuck on paint or palette? Bring your room and we’ll land on colours that actually work in your light — with swatches to take away.',
      durationMinutes: 45,
      priceCents: 12900,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'designer', kind: 'staff', skillTags: ['edesign'], count: 1 }],
      policyHandle: 'roomco-standard',
    },
    {
      handle: 'layout-consult',
      name: 'Layout consult',
      description:
        'A fresh floor plan for a room that isn’t flowing — furniture placement, traffic and scale, mapped out so it just feels right.',
      durationMinutes: 45,
      priceCents: 14900,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'designer', kind: 'staff', skillTags: ['edesign'], count: 1 }],
      policyHandle: 'roomco-standard',
    },
    {
      handle: 'room-refresh-package',
      name: 'Room refresh package',
      description:
        'A budget-friendly refresh that reworks what you own and adds a few well-chosen pieces — a whole new room without starting over.',
      durationMinutes: 60,
      priceCents: 39900,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'designer', kind: 'staff', skillTags: ['edesign'], count: 1 }],
      policyHandle: 'roomco-standard',
    },
    {
      handle: 'whole-home-consult',
      name: 'Whole-home consult',
      description:
        'A big-picture session for the whole place — a cohesive palette, a room-by-room plan and a sensible order to tackle it all in.',
      durationMinutes: 60,
      priceCents: 24900,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'designer', kind: 'staff', skillTags: ['edesign'], count: 1 }],
      policyHandle: 'roomco-standard',
    },
    {
      handle: 'styling-session',
      name: 'Styling session',
      description:
        'The finishing touch — shelves, art, textiles and the little details that make a room feel finished and personal.',
      durationMinutes: 45,
      priceCents: 15900,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'designer', kind: 'staff', skillTags: ['edesign'], count: 1 }],
      policyHandle: 'roomco-standard',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  photoHero({
    image: url(IMG.hero),
    alt: 'A bright, freshly styled living room with plants and warm textiles',
    title: 'A room you love, designed online',
    sub: 'Flat-fee interior design for real homes — share your space, get a shoppable design board, and shop the look on your own time.',
    primary: { label: 'Book a consult', href: '/book' },
    secondary: { label: 'See packages', href: '/book' },
    overlay: 'dark',
  }),
  featureRow({
    heading: 'How it works',
    items: [
      {
        title: '1 · Share your room & style',
        body: 'Send us photos, your measurements and a few things you love. A quick call gets us on the same page — no jargon, no homework.',
      },
      {
        title: '2 · Get a design board',
        body: 'We send back a shoppable design board: a layout that flows, a palette that works, and every piece picked to fit your room and budget.',
      },
      {
        title: '3 · Shop the look',
        body: 'Buy the pieces at your own pace, straight from the board. Questions along the way? We’re one message away.',
      },
    ],
  }),
  serviceMenu({
    heading: 'Flat-fee packages',
    intro: 'Simple, upfront pricing — pick what your room needs. Full details and live availability are on the booking page.',
    surface: 'muted',
    columns: 2,
    items: [
      { name: 'Free discovery consult', priceCents: 0, durationMin: 30, desc: 'A friendly call to talk through your room and style.' },
      { name: 'Single-room e-design', priceCents: 29900, durationMin: 60, desc: 'A full shoppable design board for one room.' },
      { name: 'Room refresh package', priceCents: 39900, durationMin: 60, desc: 'Rework what you own, add a few key pieces.' },
      { name: 'Colour consult', priceCents: 12900, durationMin: 45, desc: 'Paint and palette that work in your light.' },
    ],
    cta: { label: 'See everything & book', href: '/book' },
  }),
  galleryStrip({
    heading: 'Rooms we’ve refreshed',
    surface: 'base',
    columns: 3,
    images: [
      { src: url(IMG.room1), alt: 'A cosy reading nook in soft neutrals and coral accents' },
      { src: url(IMG.room2), alt: 'A cheerful home office with a green desk and gallery wall' },
      { src: url(IMG.room3), alt: 'A light-filled dining corner with rattan chairs' },
    ],
  }),
  splitFeature({
    image: url(IMG.approach),
    alt: 'A colour-and-fabric moodboard laid out on a sunny table',
    heading: 'Great design, minus the big price tag',
    body: [
      'E-design is interior design done online — which means no site visits, no hourly billing and no five-figure quote. You get the same trained eye for a clear, flat fee.',
      'Because it’s all shoppable, you stay in control: buy the whole board at once or one piece at a time, and swap anything that doesn’t fit the budget.',
    ],
    cta: { label: 'Start your room', href: '/book' },
  }),
  teamRow({
    heading: 'Meet your designers',
    intro: 'Book by name — you’ll work with the same designer from first call to final board.',
    surface: 'muted',
    members: [
      { name: 'Rae Whitfield', role: 'Interior designer', image: url(IMG.rae), alt: 'Rae Whitfield, interior designer', bio: 'Colour and styling, with a warm, layered look that feels lived-in from day one.' },
      { name: 'Devon Ellis', role: 'Interior designer', image: url(IMG.devon), alt: 'Devon Ellis, interior designer', bio: 'A layout obsessive — small spaces and awkward rooms are his favourite puzzle.' },
      { name: 'Priya Nair', role: 'Interior designer', image: url(IMG.priya), alt: 'Priya Nair, interior designer', bio: 'Room refreshes and colour, reworking what you already own into something new.' },
    ],
  }),
  testimonial({
    quote: 'I sent a few photos of my sad living room and got back a plan I could actually afford. It looks like a magazine now — and I bought it piece by piece.',
    attribution: 'Hannah, e-design client',
  }),
  bookingCta({
    title: 'Ready to love your space?',
    sub: 'Start with a free consult — pick a designer, choose a time, and see live availability. It takes about a minute.',
    cta: { label: 'Book a consult', href: '/book' },
  }),
];

const BOOK_INTRO = [
  photoHero({
    image: url(IMG.approach),
    alt: 'A colour-and-fabric moodboard laid out on a sunny table',
    title: 'Book your consult',
    sub: 'Choose a package or a free consult to see prices and live availability, then pick your designer and time.',
    primary: { label: 'See services below', href: '/book' },
    overlay: 'darker',
    align: 'start',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.hero),
    alt: 'A bright, freshly styled living room with plants and warm textiles',
    heading: 'About Room & Co.',
    body: [
      'We started Room & Co. on a simple idea: good interior design shouldn’t be reserved for people building from scratch or writing big cheques. Most of us just want the room we already have to feel better.',
      'So we do it online, for a flat fee — a real designer, a shoppable plan, and honest advice about what’s worth spending on and what isn’t. Friendly, fresh, and made for everyday homes.',
    ],
    cta: { label: 'Book a consult', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'What makes us different',
    items: [
      { title: 'Flat fees, no surprises', body: 'You know the price before you start. No hourly billing, no scope creep, no invoice you didn’t see coming.' },
      { title: 'Shop at your pace', body: 'Everything’s on a shoppable board, so you can buy it all at once or spread it out over months.' },
      { title: 'Made for real budgets', body: 'We design around what you can actually spend, and we’ll always tell you where to save and where it’s worth it.' },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Say hello',
    address: ['Room & Co.', '415 Maple Avenue', 'Studio 3 · Austin, TX 78702'],
    mapLocation: '415 Maple Avenue, Austin, TX 78702',
    hours: [
      { day: 'Monday – Friday', time: '9:00 – 6:00' },
      { day: 'Saturday', time: '10:00 – 4:00' },
      { day: 'Sunday', time: 'Closed' },
    ],
  }),
  bookingCta({
    title: 'Rather just get started?',
    sub: 'Book a free consult online and see live availability — no phone tag, no waiting.',
    surface: 'muted',
    cta: { label: 'Book a consult', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-interior-edesign',
  name: 'sparx — Interior (E-Design)',
  summary:
    'A bright, friendly interior-design site for online e-design studios — a warm coral palette, a teal accent and a modern sans, built around a HOW-IT-WORKS story and flat-fee packages. Installs a working booking flow: a real menu of consults and packages (free consult, single-room e-design, colour, layout, room refresh), three designers you book by name with their own hours, and shoppable, affordable e-design. Ships as "Room & Co." for everyday homeowners.',
  tagline: 'A bright, friendly template for online interior e-design — book consults from day one.',
  industry: 'Interior design',
  sortWeight: 35,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'Room & Co.', tagline: 'A room you love, designed online.' },
  theme: roomco,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Room & Co. — online interior e-design',
      description:
        'Room & Co. is friendly, flat-fee interior design done online. Share your room, get a shoppable design board, and book a consult with your designer.',
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
