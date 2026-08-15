// sparx-travel-adventure — "Trailhead Travel", an ADVENTURE & experiential travel planner.
//
// The bold, outdoorsy sibling of the travel family: trekking, safaris, dive trips,
// expedition cruises and small-group adventures, planned one-to-one. Deliberately the
// OPPOSITE of the refined-luxury travel template (navy, serif, bespoke concierge) — a
// deep-pine ground, a sunset-orange accent, sturdy Archivo display over Inter, and big
// landscape photography carrying the page. Same booking spine (book a planning consult),
// a different, wilder business.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-travel-adventure.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-travel-adventure/**" \
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
  hero: 'travel-adventure-hero',
  approach: 'travel-adventure-approach',
  marisol: 'travel-adventure-marisol',
  desmond: 'travel-adventure-desmond',
  priya: 'travel-adventure-priya',
  trek: 'travel-adventure-trek',
  safari: 'travel-adventure-safari',
  dive: 'travel-adventure-dive',
} as const;

// EMPTY on purpose — every image resolves through the picsum `src()` fallback below, so a
// fork ships with real, unique placeholders and swaps them in the builder. Fill an entry
// here to hot-link a specific photo.
const PHOTO: Record<string, string> = {
  "trailhead-hero": "https://images.unsplash.com/photo-1551632811-561732d1e306?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bW91bnRhaW4lMjBoaWtpbmclMjBhZHZlbnR1cmV8ZW58MHwwfHx8MTc4NjM5NTE2OHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "trailhead-approach": "https://images.unsplash.com/photo-1509762774605-f07235a08f1f?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dHJhdmVsJTIwcGxhbm5pbmclMjBiYWNrcGFja3xlbnwwfDB8fHwxNzg2Mzk1MTcxfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "trailhead-marisol": "https://images.unsplash.com/photo-1496707790243-64ac86cae0d1?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjBoaWtlciUyMHBvcnRyYWl0fGVufDB8MHx8fDE3ODYzOTUxNzR8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "trailhead-desmond": "https://images.unsplash.com/photo-1600486913747-55e5470d6f40?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YWR2ZW50dXJlciUyMHBvcnRyYWl0JTIwbWFufGVufDB8MHx8fDE3ODYzOTUxNzh8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "trailhead-priya": "https://images.unsplash.com/photo-1534385904739-212d1429f618?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjB0cmF2ZWxlciUyMHBvcnRyYWl0fGVufDB8MHx8fDE3ODYzOTUxODF8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "trailhead-trek": "https://images.unsplash.com/photo-1454496522488-7a8e488e8606?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dHJla2tpbmclMjBtb3VudGFpbnN8ZW58MHwwfHx8MTc4NjM5NTE4NXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "trailhead-safari": "https://images.unsplash.com/photo-1598755257130-c2aaca1f061c?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c2FmYXJpJTIwd2lsZGxpZmV8ZW58MHwwfHx8MTc4NjM5NTE4OHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "trailhead-dive": "https://images.unsplash.com/photo-1682687982167-d7fb3ed8541d?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c2N1YmElMjBkaXZpbmclMjBvY2VhbnxlbnwwfDB8fHwxNzg2Mzk1MTkxfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (seed: string): string =>
  PHOTO[seed] ?? `https://picsum.photos/seed/${seed}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}
const ASSETS: Asset[] = [
  { id: IMG.hero, url: src('trailhead-hero'), alt: 'A hiker on a ridgeline above a wide mountain valley at sunrise' },
  { id: IMG.approach, url: src('trailhead-approach'), alt: 'A specialist marking a route on a map spread over a trailhead table' },
  { id: IMG.marisol, url: src('trailhead-marisol'), alt: 'Marisol Vega, trekking & safari specialist' },
  { id: IMG.desmond, url: src('trailhead-desmond'), alt: 'Desmond Okoye, dive & expedition-cruise specialist' },
  { id: IMG.priya, url: src('trailhead-priya'), alt: 'Priya Anand, high-altitude & expedition specialist' },
  { id: IMG.trek, url: src('trailhead-trek'), alt: 'Trekkers crossing a high alpine pass under clear skies' },
  { id: IMG.safari, url: src('trailhead-safari'), alt: 'A safari vehicle watching elephants on the savanna at golden hour' },
  { id: IMG.dive, url: src('trailhead-dive'), alt: 'A diver gliding over a bright coral reef in clear blue water' },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-travel-adventure: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "trailhead": warm off-white ground, deep-pine primary, sunset-orange accent ─
const trailhead = defineTheme({
  name: 'trailhead',
  type: { body: face('Inter', 'sans-serif'), head: face('Archivo', 'sans-serif') },
  shape: { selector: '0.25rem', field: '0.25rem', box: '0.375rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(97% 0.012 90)', // warm off-white / sand
      'oklch(93% 0.016 88)', // oat
      'oklch(87% 0.018 85)', // hairline
      'oklch(24% 0.02 150)', // deep pine ink
    ],
    roles: {
      primary: 'oklch(45% 0.09 155)', // deep pine / forest
      secondary: 'oklch(37% 0.03 150)', // dark spruce — readable micro-labels on light
      accent: 'oklch(65% 0.16 45)', // sunset orange
      neutral: 'oklch(27% 0.015 150)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(22% 0.02 155)',
      'oklch(18% 0.016 155)',
      'oklch(14% 0.012 155)',
      'oklch(94% 0.012 90)',
    ],
    roles: {
      primary: 'oklch(70% 0.11 155)', // bright pine
      secondary: 'oklch(78% 0.02 150)',
      accent: 'oklch(72% 0.15 47)', // ember orange
      neutral: 'oklch(82% 0.015 150)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the booking spine (policies, specialists + hours, the consult menu) ───
const hours = (days: number[], startMinute: number, endMinute: number) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

const SCHEDULING = {
  policies: [
    {
      handle: 'travel-standard',
      name: 'Standard consultation',
      depositType: 'none',
      cancellationWindowHours: 48,
      reminderOffsetsMin: [2880, 120],
      policyText:
        'Free to book, free to change — just give us at least 48 hours’ notice to reschedule or cancel your consultation. We’ll send a reminder two days before and again two hours ahead.',
    },
    {
      handle: 'planning-deposit',
      name: 'Trip-planning deposit',
      depositType: 'deposit',
      depositAmountCents: 7500,
      cancellationWindowHours: 48,
      reminderOffsetsMin: [2880, 1440, 120],
      policyText:
        'In-depth planning sessions hold a $75 planning fee that comes straight off your trip when you book. Reschedule with 48 hours’ notice and it carries over to your new time.',
    },
  ],
  resources: [
    {
      handle: 'marisol',
      name: 'Marisol Vega',
      kind: 'staff',
      skillTags: ['trekking', 'safari', 'general'],
      windows: hours([1, 2, 3, 4, 5], 540, 1080), // Mon–Fri 9–6
    },
    {
      handle: 'desmond',
      name: 'Desmond Okoye',
      kind: 'staff',
      skillTags: ['diving', 'cruise', 'general'],
      windows: hours([2, 3, 4, 5, 6], 600, 1140), // Tue–Sat 10–7
    },
    {
      handle: 'priya',
      name: 'Priya Anand',
      kind: 'staff',
      skillTags: ['expedition', 'trekking', 'general'],
      windows: hours([1, 3, 4, 5, 6], 540, 1020), // Mon, Wed–Sat 9–5
    },
  ],
  services: [
    {
      handle: 'discovery-call',
      name: 'Discovery call',
      description:
        'A free, no-pressure 30 minutes to talk through where you dream of going, when, and what kind of adventure fits you. We’ll point you to the right next step.',
      durationMinutes: 30,
      priceCents: 0,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'specialist', kind: 'staff', skillTags: ['general'], count: 1 }],
      policyHandle: 'travel-standard',
    },
    {
      handle: 'custom-adventure-consult',
      name: 'Custom adventure planning',
      description:
        'A deep dive into a one-of-a-kind trip built around you — routing, timing, budget and the details that make it yours. For travelers who know roughly where, not exactly how.',
      durationMinutes: 60,
      priceCents: 7500,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'specialist', kind: 'staff', skillTags: ['general'], count: 1 }],
      policyHandle: 'planning-deposit',
    },
    {
      handle: 'trekking-trip-consult',
      name: 'Trekking & hiking consult',
      description:
        'Plan a multi-day trek — Patagonia, the Alps, Nepal, the Andes. We’ll match the route to your fitness, sort permits and huts, and get the logistics off your plate.',
      durationMinutes: 45,
      priceCents: 5000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'specialist', kind: 'staff', skillTags: ['general'], count: 1 }],
      policyHandle: 'planning-deposit',
    },
    {
      handle: 'safari-consult',
      name: 'Safari & wildlife consult',
      description:
        'Design a safari around the migration, the season and the animals you most want to see, with camps and guides we know and trust on the ground.',
      durationMinutes: 45,
      priceCents: 5000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'specialist', kind: 'staff', skillTags: ['safari'], count: 1 }],
      policyHandle: 'planning-deposit',
    },
    {
      handle: 'dive-trip-consult',
      name: 'Dive trip consult',
      description:
        'From liveaboards to reef-side lodges — plan a dive trip matched to your certification and the marine life on your list, with the timing that gives you the best water.',
      durationMinutes: 45,
      priceCents: 5000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'specialist', kind: 'staff', skillTags: ['diving'], count: 1 }],
      policyHandle: 'planning-deposit',
    },
    {
      handle: 'expedition-cruise-consult',
      name: 'Expedition cruise consult',
      description:
        'Antarctica, the Arctic, the Galápagos and beyond — choose the right ship, cabin and departure, and understand exactly what a small-ship expedition is really like.',
      durationMinutes: 60,
      priceCents: 7500,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'specialist', kind: 'staff', skillTags: ['general'], count: 1 }],
      policyHandle: 'planning-deposit',
    },
    {
      handle: 'group-adventure-consult',
      name: 'Small-group & private departures',
      description:
        'Planning a trip for a family, a friend group or a milestone celebration? We’ll build a small-group or private adventure that keeps everyone happy and moving.',
      durationMinutes: 60,
      priceCents: 5000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'specialist', kind: 'staff', skillTags: ['general'], count: 1 }],
      policyHandle: 'planning-deposit',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  photoHero({
    image: url(IMG.hero),
    alt: 'A hiker on a ridgeline above a wide mountain valley at sunrise',
    title: 'Go further than the guidebook',
    sub: 'Trekking, safaris, dive trips and expedition cruises — planned one-to-one by people who’ve been there, so all you have to do is show up and go.',
    primary: { label: 'Plan your adventure', href: '/book' },
    secondary: { label: 'See how it works', href: '/book' },
    overlay: 'darker',
  }),
  featureRow({
    items: [
      {
        title: 'Real adventure specialists',
        body: 'You plan with someone who has actually walked the pass, dived the reef or tracked the migration — not a call-center script reading from the same brochure.',
      },
      {
        title: 'Small groups & solo, both',
        body: 'Travelling alone, as a couple or with a whole crew, we build the trip around your pace and your people — never a bus of forty strangers.',
      },
      {
        title: 'Responsible & local',
        body: 'We work with local guides, camps and operators who look after the places we send you — so your trip leaves them better, not busier.',
      },
      {
        title: 'Logistics handled',
        body: 'Permits, transfers, gear lists, altitude, timing the seasons — the hundred fiddly details are ours to sort. You get the adventure without the admin.',
      },
    ],
  }),
  serviceMenu({
    heading: 'Where do you want to go?',
    intro: 'Every trip starts with a conversation. Book a consult below — the discovery call is on us — and we’ll take it from there. Full details and live times are on the booking page.',
    surface: 'muted',
    columns: 2,
    items: [
      { name: 'Discovery call', priceCents: 0, durationMin: 30, desc: 'Free — talk it through, find your next step.' },
      { name: 'Custom adventure planning', priceCents: 7500, durationMin: 60, desc: 'A one-of-a-kind trip built around you.' },
      { name: 'Trekking & hiking', priceCents: 5000, durationMin: 45, desc: 'Multi-day treks, permits and huts sorted.' },
      { name: 'Safari & wildlife', priceCents: 5000, durationMin: 45, desc: 'Camps and guides we know on the ground.' },
      { name: 'Dive trips', priceCents: 5000, durationMin: 45, desc: 'Liveaboards and reefs matched to your cert.' },
      { name: 'Expedition cruises', priceCents: 7500, durationMin: 60, desc: 'Antarctica, the Arctic, the Galápagos.' },
    ],
    cta: { label: 'See everything & book', href: '/book' },
  }),
  galleryStrip({
    heading: 'Adventures we’ve sent people on',
    surface: 'base',
    columns: 3,
    images: [
      { src: url(IMG.trek), alt: 'Trekkers crossing a high alpine pass under clear skies' },
      { src: url(IMG.safari), alt: 'A safari vehicle watching elephants on the savanna at golden hour' },
      { src: url(IMG.dive), alt: 'A diver gliding over a bright coral reef in clear blue water' },
    ],
  }),
  splitFeature({
    image: url(IMG.approach),
    alt: 'A specialist marking a route on a map spread over a trailhead table',
    heading: 'How we plan an adventure',
    body: [
      'It starts with a real conversation — where you’re dreaming of, when you can go, how hard you want to push and what would make the trip unforgettable for you.',
      'Then your specialist builds the route: the right season, the right guides, the logistics that make a big trip feel effortless. You review, we refine, and only when it’s exactly right do you book.',
    ],
    cta: { label: 'Start with a discovery call', href: '/book' },
  }),
  teamRow({
    heading: 'Meet your specialists',
    intro: 'Book by name — you’ll plan with the person whose corner of the world you’re headed to.',
    members: [
      { name: 'Marisol Vega', role: 'Trekking & safari', image: url(IMG.marisol), alt: 'Marisol Vega, trekking & safari specialist', bio: 'Twelve seasons across the Andes and East Africa. Marisol plans treks and safaris that push just far enough.' },
      { name: 'Desmond Okoye', role: 'Dive & expedition cruise', image: url(IMG.desmond), alt: 'Desmond Okoye, dive & expedition-cruise specialist', bio: 'A divemaster and polar-ship veteran who knows which reefs and which departures are actually worth it.' },
      { name: 'Priya Anand', role: 'High-altitude & expedition', image: url(IMG.priya), alt: 'Priya Anand, high-altitude & expedition specialist', bio: 'Himalayan permits, acclimatisation and remote logistics — the higher and harder the trip, the more she’s in her element.' },
    ],
  }),
  testimonial({
    quote: 'They planned the Kilimanjaro climb I’d been putting off for a decade — every permit, every campsite, the perfect week to go. I summited at sunrise and cried. Best trip of my life, zero stress getting there.',
    attribution: 'Daniel R., climbed with Trailhead in 2024',
    surface: 'primary',
  }),
  bookingCta({
    title: 'Your next adventure starts here',
    sub: 'Book a free discovery call, tell us the dream, and we’ll map the way there. It takes about a minute to grab a time.',
    cta: { label: 'Plan your adventure', href: '/book' },
  }),
];

const BOOK_INTRO = [
  photoHero({
    image: url(IMG.approach),
    alt: 'A specialist marking a route on a map spread over a trailhead table',
    title: 'Plan your adventure',
    sub: 'Choose a consult to see what it covers and how long it takes, then pick your specialist and a live time. The discovery call is always free.',
    primary: { label: 'See consults below', href: '/book' },
    overlay: 'darker',
    align: 'start',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.hero),
    alt: 'A hiker on a ridgeline above a wide mountain valley at sunrise',
    heading: 'About Trailhead Travel',
    body: [
      'We started Trailhead because the best trips of our lives were never the ones we booked off a shelf — they were the ones someone who’d been there helped us build. So that’s what we do, all day: plan real adventures for people who want more than a package.',
      'We’re travellers first. Between us we’ve trekked the big passes, dived the far reefs, tracked the migration and sailed to both poles. That first-hand knowledge is the whole point — it’s the difference between a trip that works and a trip you’ll never forget.',
    ],
    cta: { label: 'Book a discovery call', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'What you can count on',
    items: [
      { title: 'We’ve been there', body: 'Every specialist plans in the region they know first-hand — not from a brochure, from boots on the ground.' },
      { title: 'Built around you', body: 'Your pace, your budget, your must-dos. We shape the trip to fit, then refine it until it’s exactly right.' },
      { title: 'Good for the places we love', body: 'Local guides and operators, sustainable choices, and travel that gives back to the destinations we send you to.' },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Come talk adventures',
    address: ['Trailhead Travel', '47 Basecamp Road', 'Suite 5 · Boulder, CO 80302'],
    mapLocation: '47 Basecamp Road, Boulder, CO 80302',
    hours: [
      { day: 'Monday – Friday', time: '9:00 – 6:00' },
      { day: 'Saturday', time: '10:00 – 4:00' },
      { day: 'Sunday', time: 'Closed' },
    ],
  }),
  bookingCta({
    title: 'Rather book than call?',
    sub: 'Grab a free discovery call online and see live times — no phone tag, no waiting on a callback.',
    surface: 'muted',
    cta: { label: 'Plan your adventure', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-travel-adventure',
  name: 'Travel (Adventure)',
  summary:
    'A bold, outdoorsy travel-planning site — a deep-pine palette with a sunset-orange accent and sturdy type, built for adventure and experiential trips. Installs a working booking flow: consults from a free discovery call to trekking, safari, dive and expedition-cruise planning, three adventure specialists you book by name with their own hours, and a planning-deposit policy. Ships as "Trailhead Travel", for small-group, off-the-beaten-path adventures.',
  tagline: 'A bold, outdoorsy template for adventure travel — book planning consults online from day one.',
  industry: 'Travel',
  sortWeight: 15,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'Trailhead Travel', tagline: 'Go further than the guidebook.' },
  theme: trailhead,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Trailhead Travel — adventure & experiential trip planning',
      description:
        'Trailhead Travel plans trekking, safaris, dive trips and expedition cruises one-to-one. Book a free discovery call with an adventure specialist online.',
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
