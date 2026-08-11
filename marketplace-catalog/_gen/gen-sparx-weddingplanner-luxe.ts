// sparx-weddingplanner-luxe — "Ever After Events", a luxury full-service WEDDING planner.
//
// The elegant, romantic end of the event-planning research (Mindy Weiss / Lynn Easton /
// Bryan Rafanelli lane): a soft-ivory ground, a dusty-rose blush primary, a champagne-gold
// accent, an elegant serif display over a humanist sans, and soft, romantic wedding
// photography carrying the page. Deliberately the WEDDING sibling — distinct from the
// modern corporate/social event-planning template (crisp, brisk, business-social) — same
// booking spine, a different business: full & partial planning, day-of coordination,
// design & styling, and destination weddings, all booked through a consultation.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-weddingplanner-luxe.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-weddingplanner-luxe/**" \
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
  hero: 'weddingplanner-luxe-hero',
  studio: 'weddingplanner-luxe-studio',
  work1: 'weddingplanner-luxe-work1',
  work2: 'weddingplanner-luxe-work2',
  work3: 'weddingplanner-luxe-work3',
  work4: 'weddingplanner-luxe-work4',
  work5: 'weddingplanner-luxe-work5',
  work6: 'weddingplanner-luxe-work6',
} as const;

// EMPTY on purpose — every image falls back to a deterministic picsum seed (unique,
// prefixed `everafter-`), so the bundle renders with real photography stand-ins the
// tenant swaps for their own portfolio in the builder.
const PHOTO: Record<string, string> = {
  "everafter-hero": "https://images.unsplash.com/photo-1524824267900-2fa9cbf7a506?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZWxlZ2FudCUyMHdlZGRpbmclMjByZWNlcHRpb258ZW58MHwwfHx8MTc4NjM5MjY0Mnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "everafter-studio": "https://images.unsplash.com/photo-1785123059195-13accd32839b?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d2VkZGluZyUyMHBsYW5uZXIlMjBkZXNrfGVufDB8MHx8fDE3ODYzOTI2NDV8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "everafter-work1": "https://images.unsplash.com/photo-1630527152680-500b5453fb04?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d2VkZGluZyUyMHRhYmxlJTIwc2V0dGluZ3xlbnwwfDB8fHwxNzg2MzkyNjQ4fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "everafter-work2": "https://images.unsplash.com/photo-1595467959554-9ffcbf37f10f?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d2VkZGluZyUyMGZsb3dlcnMlMjBib3VxdWV0fGVufDB8MHx8fDE3ODYzOTI2NTF8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "everafter-work3": "https://images.unsplash.com/photo-1529636798458-92182e662485?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d2VkZGluZyUyMGNlcmVtb255JTIwYXJjaHxlbnwwfDB8fHwxNzg2MzkyNjU1fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "everafter-work4": "https://images.unsplash.com/photo-1524777313293-86d2ab467344?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d2VkZGluZyUyMHJlY2VwdGlvbiUyMGRlY29yfGVufDB8MHx8fDE3ODYzOTI2NTd8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "everafter-work5": "https://images.unsplash.com/photo-1549488497-94b52bddac5d?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YnJpZGUlMjB3ZWRkaW5nJTIwZHJlc3N8ZW58MHwwfHx8MTc4NjM5MjY2MHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "everafter-work6": "https://images.unsplash.com/photo-1604702433171-33756f3f3825?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d2VkZGluZyUyMGNha2UlMjBlbGVnYW50fGVufDB8MHx8fDE3ODYzOTI2NjN8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (seed: string): string =>
  PHOTO[seed] ?? `https://picsum.photos/seed/${seed}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}
const ASSETS: Asset[] = [
  { id: IMG.hero, url: src('everafter-hero'), alt: 'A candlelit garden wedding reception at golden hour' },
  { id: IMG.studio, url: src('everafter-studio'), alt: 'A bright design studio with mood boards, swatches and florals' },
  { id: IMG.work1, url: src('everafter-work1'), alt: 'An elegant tablescape with taper candles and soft blush florals' },
  { id: IMG.work2, url: src('everafter-work2'), alt: 'A bride and groom beneath a floral arch at sunset' },
  { id: IMG.work3, url: src('everafter-work3'), alt: 'A ceremony aisle lined with petals and greenery' },
  { id: IMG.work4, url: src('everafter-work4'), alt: 'A romantic reception under warm string lights' },
  { id: IMG.work5, url: src('everafter-work5'), alt: 'A destination wedding overlooking the coast' },
  { id: IMG.work6, url: src('everafter-work6'), alt: 'A close detail of the bridal bouquet and rings' },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-weddingplanner-luxe: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "everafter": soft-ivory ground, dusty-rose primary, champagne-gold accent ──
const everafter = defineTheme({
  name: 'everafter',
  type: { body: face('Inter', 'sans-serif'), head: face('Fraunces', 'serif') },
  shape: { selector: '0.25rem', field: '0.25rem', box: '0.375rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(97% 0.006 90)', // soft ivory
      'oklch(94% 0.012 22)', // blush oat
      'oklch(89% 0.016 22)', // hairline
      'oklch(25% 0.02 25)', // deep plum-charcoal ink
    ],
    roles: {
      primary: 'oklch(70% 0.062 15)', // dusty rose / blush
      secondary: 'oklch(38% 0.022 22)', // deep, readable rosewood-charcoal
      accent: 'oklch(80% 0.06 86)', // champagne gold
      neutral: 'oklch(28% 0.016 25)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(22% 0.015 22)',
      'oklch(18% 0.012 22)',
      'oklch(14% 0.01 22)',
      'oklch(95% 0.006 90)',
    ],
    roles: {
      primary: 'oklch(78% 0.07 16)',
      secondary: 'oklch(76% 0.015 30)',
      accent: 'oklch(84% 0.06 86)',
      neutral: 'oklch(84% 0.012 40)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the booking spine (policies, planners + hours, the consultation menu) ──
const hours = (days: number[], startMinute: number, endMinute: number) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

const SCHEDULING = {
  policies: [
    {
      handle: 'consult-standard',
      name: 'Standard consultation',
      depositType: 'none',
      cancellationWindowHours: 48,
      reminderOffsetsMin: [2880, 1440, 120],
      policyText:
        'Please give us at least 48 hours’ notice to reschedule or cancel a consultation. We’ll send a reminder two days before, the day before, and two hours ahead.',
    },
    {
      handle: 'booking-deposit',
      name: 'Booking deposit',
      depositType: 'deposit',
      depositAmountCents: 5000,
      cancellationWindowHours: 72,
      reminderOffsetsMin: [4320, 1440, 120],
      policyText:
        'Longer planning consultations hold a $50 deposit that comes off your first invoice when you book us. Reschedule with 72 hours’ notice and it carries over to your new time.',
    },
  ],
  resources: [
    {
      handle: 'eleanor',
      name: 'Eleanor Vance',
      kind: 'staff',
      skillTags: ['wedding', 'design', 'full-planning', 'styling'],
      windows: hours([2, 3, 4, 5, 6], 540, 1080), // Tue–Sat 9–6
    },
    {
      handle: 'priya',
      name: 'Priya Anand',
      kind: 'staff',
      skillTags: ['wedding', 'coordination', 'day-of', 'partial-planning'],
      windows: hours([1, 2, 3, 4, 5], 600, 1140), // Mon–Fri 10–7
    },
    {
      handle: 'marco',
      name: 'Marco Reyes',
      kind: 'staff',
      skillTags: ['wedding', 'destination', 'design', 'styling'],
      windows: hours([3, 4, 5, 6, 0], 600, 1080), // Wed–Sun 10–6
    },
  ],
  services: [
    {
      handle: 'discovery-call',
      name: 'Discovery call',
      description: 'A relaxed 30-minute call to hear your vision, your date and your budget — and see if we’re the right fit. No cost, no pressure.',
      durationMinutes: 30,
      priceCents: 0,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'planner', kind: 'staff', skillTags: ['wedding'], count: 1 }],
      policyHandle: 'consult-standard',
    },
    {
      handle: 'full-planning-consult',
      name: 'Full planning consultation',
      description: 'A deep-dive session for couples who want us start to finish — venue, vendors, design, timeline and the day itself.',
      durationMinutes: 60,
      priceCents: 15000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'planner', kind: 'staff', skillTags: ['wedding'], count: 1 }],
      policyHandle: 'booking-deposit',
    },
    {
      handle: 'partial-planning-consult',
      name: 'Partial planning consultation',
      description: 'You’ve made a start — we come in to shape the vendors, design and logistics, and carry it over the line.',
      durationMinutes: 45,
      priceCents: 10000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'planner', kind: 'staff', skillTags: ['wedding'], count: 1 }],
      policyHandle: 'booking-deposit',
    },
    {
      handle: 'day-of-coordination-consult',
      name: 'Day-of coordination consultation',
      description: 'You’ve planned it beautifully — we step in for the final weeks to run the timeline, the vendors and the day so you can be present.',
      durationMinutes: 45,
      priceCents: 8000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'planner', kind: 'staff', skillTags: ['wedding'], count: 1 }],
      policyHandle: 'consult-standard',
    },
    {
      handle: 'design-styling-consult',
      name: 'Design & styling consultation',
      description: 'A creative session on the look and feel — palette, florals, tablescapes, lighting and the details that tie your day together.',
      durationMinutes: 60,
      priceCents: 12000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'planner', kind: 'staff', skillTags: ['wedding'], count: 1 }],
      policyHandle: 'booking-deposit',
    },
    {
      handle: 'destination-wedding-consult',
      name: 'Destination wedding consultation',
      description: 'Marrying somewhere further afield? We plan the travel, the local vendors and the multi-day celebration end to end.',
      durationMinutes: 60,
      priceCents: 18000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'planner', kind: 'staff', skillTags: ['wedding'], count: 1 }],
      policyHandle: 'booking-deposit',
    },
    {
      handle: 'venue-tour-consult',
      name: 'Venue tour walkthrough',
      description: 'Meet us at a shortlisted venue and we’ll walk it with you — flow, capacity, backup plans and how your design will sit in the space.',
      durationMinutes: 60,
      priceCents: 9000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'planner', kind: 'staff', skillTags: ['wedding'], count: 1 }],
      policyHandle: 'consult-standard',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  photoHero({
    image: url(IMG.hero),
    alt: 'A candlelit garden wedding reception at golden hour',
    title: 'The wedding you’ve pictured, handled with grace',
    sub: 'Ever After Events is a full-service wedding studio for couples who want a beautiful day and a calm road to it. Design, planning and flawless coordination — all in one place.',
    primary: { label: 'Book a consultation', href: '/book' },
    secondary: { label: 'See how we help', href: '/book' },
    overlay: 'dark',
  }),
  featureRow({
    items: [
      {
        title: 'Full & partial planning',
        body: 'Hand us the whole thing, or just the parts you’d rather not carry. Either way you get a plan, a timeline and someone who has done this a hundred times.',
      },
      {
        title: 'A trusted vendor circle',
        body: 'Florists, photographers, caterers and venues we know and love — matched to your style and your budget, never a cold guess from a directory.',
      },
      {
        title: 'Design & styling',
        body: 'Palette, florals, tablescapes and lighting composed into one cohesive look, so every corner of your day feels considered and unmistakably yours.',
      },
      {
        title: 'A stress-free day',
        body: 'On the day, we run the timeline and the vendors so you don’t touch a thing. You get to be fully present — and so does everyone you love.',
      },
    ],
  }),
  serviceMenu({
    heading: 'Ways to work with us',
    intro: 'Every couple starts with a consultation. Choose the one that fits where you are — full prices and live availability are on the booking page.',
    surface: 'muted',
    columns: 2,
    items: [
      { name: 'Discovery call', priceCents: 0, durationMin: 30, desc: 'A no-cost first chat about your vision and date.' },
      { name: 'Full planning consultation', priceCents: 15000, durationMin: 60, desc: 'For couples who want us start to finish.' },
      { name: 'Design & styling consultation', priceCents: 12000, durationMin: 60, desc: 'Palette, florals and the look of the day.' },
      { name: 'Day-of coordination', priceCents: 8000, durationMin: 45, desc: 'We run the final weeks and the day itself.' },
    ],
    cta: { label: 'See everything & book', href: '/book' },
  }),
  galleryStrip({
    heading: 'A few of our celebrations',
    surface: 'base',
    columns: 3,
    images: [
      { src: url(IMG.work1), alt: 'An elegant tablescape with taper candles and soft blush florals' },
      { src: url(IMG.work2), alt: 'A bride and groom beneath a floral arch at sunset' },
      { src: url(IMG.work3), alt: 'A ceremony aisle lined with petals and greenery' },
      { src: url(IMG.work4), alt: 'A romantic reception under warm string lights' },
      { src: url(IMG.work5), alt: 'A destination wedding overlooking the coast' },
      { src: url(IMG.work6), alt: 'A close detail of the bridal bouquet and rings' },
    ],
  }),
  splitFeature({
    image: url(IMG.studio),
    alt: 'A bright design studio with mood boards, swatches and florals',
    heading: 'Our philosophy: fewer weddings, all of us',
    body: [
      'We take on a small number of weddings each season so every couple gets our full attention — not a template with your name dropped in. Your day is designed from your story, not last season’s trend board.',
      'From the first mood board to the last dance, one team stays with you the whole way. No handoffs, no surprises — just a calm, considered plan and people who genuinely care that it goes beautifully.',
    ],
    cta: { label: 'Start with a consultation', href: '/book' },
  }),
  testimonial({
    quote: 'We honestly enjoyed our engagement instead of drowning in spreadsheets. On the day we didn’t lift a finger — everything was exactly as we’d dreamed, only better. Worth every penny and then some.',
    attribution: 'Sofia & James, married Autumn 2025',
  }),
  bookingCta({
    title: 'Let’s talk about your day',
    sub: 'Book a consultation and tell us your vision, your date and your budget. It takes about a minute, and the first call is on us.',
    cta: { label: 'Book a consultation', href: '/book' },
  }),
];

const BOOK_INTRO = [
  photoHero({
    image: url(IMG.work2),
    alt: 'A bride and groom beneath a floral arch at sunset',
    title: 'Book your consultation',
    sub: 'Choose a consultation to see what it covers, how long it takes and live availability — then pick your planner and time.',
    primary: { label: 'See consultations below', href: '/book' },
    overlay: 'darker',
    align: 'start',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.hero),
    alt: 'A candlelit garden wedding reception at golden hour',
    heading: 'About Ever After Events',
    body: [
      'Ever After Events began with a simple belief: planning a wedding should feel as joyful as the day itself. Too many couples spend their engagement stressed and stretched thin. We exist to take that weight off your shoulders.',
      'We’re a full-service studio — design, planning and coordination under one roof — led by planners who’ve shaped hundreds of celebrations, from intimate garden ceremonies to multi-day destination weddings.',
    ],
    cta: { label: 'Book a consultation', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'How we work',
    items: [
      { title: 'It starts with your story', body: 'Every plan begins with a real conversation about the two of you — how you met, how you celebrate, and the day you’ve always pictured.' },
      { title: 'One team, all the way', body: 'The people you meet on your first call are the people running your wedding. No handoffs, no strangers on the day — just familiar faces who know your plan cold.' },
      { title: 'Beautiful and buttoned-up', body: 'We obsess over the look and the logistics in equal measure — the tablescape and the timeline — so your day is as smooth as it is stunning.' },
    ],
  }),
  galleryStrip({
    heading: 'From our recent weddings',
    surface: 'base',
    columns: 3,
    images: [
      { src: url(IMG.work3), alt: 'A ceremony aisle lined with petals and greenery' },
      { src: url(IMG.work4), alt: 'A romantic reception under warm string lights' },
      { src: url(IMG.work1), alt: 'An elegant tablescape with taper candles and soft blush florals' },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Visit the studio',
    address: ['Ever After Events', '54 Rosewood Lane', 'Studio 3 · Charleston, SC 29401'],
    mapLocation: '54 Rosewood Lane, Charleston, SC 29401',
    hours: [
      { day: 'Monday – Friday', time: '9:00 – 6:00' },
      { day: 'Saturday', time: 'By appointment' },
      { day: 'Sunday', time: 'By appointment' },
    ],
  }),
  bookingCta({
    title: 'Rather book than call?',
    sub: 'See live availability and reserve a consultation online — no phone tag, and the first call is complimentary.',
    surface: 'muted',
    cta: { label: 'Book a consultation', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-weddingplanner-luxe',
  name: 'sparx — Wedding Planner (Luxe)',
  summary:
    'An elegant, romantic wedding-studio site — a soft-ivory palette, a dusty-rose primary and a champagne-gold accent, with editorial wedding photography carrying the page. Installs online booking for planning consultations, planners you book by name as bookable resources, and a booking-deposit policy. Ships as "Ever After Events", a luxury full-service wedding planner.',
  tagline: 'A romantic, editorial template for wedding planners — book consultations from day one.',
  industry: 'Event planning',
  sortWeight: 40,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'Ever After Events', tagline: 'Weddings, beautifully handled.' },
  theme: everafter,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Ever After Events — luxury wedding planning',
      description:
        'Ever After Events is a full-service wedding studio — planning, design and day-of coordination. Book a consultation online and start with a complimentary discovery call.',
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
