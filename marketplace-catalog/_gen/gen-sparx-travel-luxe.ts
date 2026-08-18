// sparx-travel-luxe — "Wander & Co. Travel", a luxury bespoke TRAVEL ADVISORY.
//
// The refined, worldly, effortless end of the travel lane: a deep navy-teal primary, a
// warm brass accent and an elegant serif display over a soft ivory ground, with worldly
// destination photography carrying the page. Deliberately the LUXURY BESPOKE sibling —
// the adventure/experiential travel template is a different business (louder, kinetic,
// outdoors) — same consultation-booking spine, a different feel: custom itineraries,
// honeymoons, VIP access, for discerning travelers who want it handled.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @wizeworks/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-travel-luxe.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-travel-luxe/**" \
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
  hero: 'travel-luxe-hero',
  planning: 'travel-luxe-planning',
  dest1: 'travel-luxe-dest1',
  dest2: 'travel-luxe-dest2',
  dest3: 'travel-luxe-dest3',
  dest4: 'travel-luxe-dest4',
  dest5: 'travel-luxe-dest5',
  dest6: 'travel-luxe-dest6',
} as const;

const PHOTO: Record<string, string> = {
  "wander-hero": "https://images.unsplash.com/photo-1743356174397-d6da6f014f8f?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bHV4dXJ5JTIwdHJhdmVsJTIwZGVzdGluYXRpb258ZW58MHwwfHx8MTc4NjM5NTE0NXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "wander-planning": "https://images.unsplash.com/photo-1516738901171-8eb4fc13bd20?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dHJhdmVsJTIwcGxhbm5pbmclMjBtYXB8ZW58MHwwfHx8MTc4NjM5NTE0OHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "wander-santorini": "https://images.unsplash.com/photo-1580502304784-8985b7eb7260?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c2FudG9yaW5pJTIwZ3JlZWNlfGVufDB8MHx8fDE3ODYzOTUxNTF8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "wander-safari": "https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YWZyaWNhJTIwc2FmYXJpJTIwbGFuZHNjYXBlfGVufDB8MHx8fDE3ODYzOTUxNTR8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "wander-kyoto": "https://images.unsplash.com/photo-1578469645742-46cae010e5d4?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8a3lvdG8lMjBqYXBhbiUyMHRlbXBsZXxlbnwwfDB8fHwxNzg2Mzk1MTU3fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "wander-alps": "https://images.unsplash.com/photo-1521292270410-a8c4d716d518?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c3dpc3MlMjBhbHBzJTIwbW91bnRhaW5zfGVufDB8MHx8fDE3ODYzOTUxNjB8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "wander-maldives": "https://images.unsplash.com/photo-1590523277543-a94d2e4eb00b?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bWFsZGl2ZXMlMjBiZWFjaCUyMHJlc29ydHxlbnwwfDB8fHwxNzg2Mzk1MTYyfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "wander-amalfi": "https://images.unsplash.com/photo-1583844056361-4418a8f2a985?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YW1hbGZpJTIwY29hc3QlMjBpdGFseXxlbnwwfDB8fHwxNzg2Mzk1MTY1fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (seed: string): string =>
  PHOTO[seed] ?? `https://picsum.photos/seed/${seed}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}
const ASSETS: Asset[] = [
  { id: IMG.hero, url: src('wander-hero'), alt: 'An infinity pool overlooking a turquoise coastline at golden hour' },
  { id: IMG.planning, url: src('wander-planning'), alt: 'A travel advisor mapping a route over open guidebooks and a world map' },
  { id: IMG.dest1, url: src('wander-santorini'), alt: 'White cliffside villages above the Aegean Sea' },
  { id: IMG.dest2, url: src('wander-safari'), alt: 'Elephants crossing a golden savanna at dusk' },
  { id: IMG.dest3, url: src('wander-kyoto'), alt: 'A quiet temple garden framed by autumn maples in Kyoto' },
  { id: IMG.dest4, url: src('wander-alps'), alt: 'A chalet terrace facing snow-capped alpine peaks' },
  { id: IMG.dest5, url: src('wander-maldives'), alt: 'An overwater villa on a still lagoon at sunrise' },
  { id: IMG.dest6, url: src('wander-amalfi'), alt: 'A pastel coastal town tumbling toward the Mediterranean' },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-travel-luxe: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "wander": ivory ground, deep navy-teal primary, brass accent, serif display ─
const wander = defineTheme({
  name: 'wander',
  type: { body: face('Inter', 'sans-serif'), head: face('Cormorant Garamond', 'serif') },
  shape: { selector: '0.25rem', field: '0.25rem', box: '0.375rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(97% 0.006 90)', // soft ivory
      'oklch(93% 0.008 88)', // sand
      'oklch(87% 0.012 86)', // hairline
      'oklch(24% 0.03 235)', // deep navy ink
    ],
    roles: {
      primary: 'oklch(40% 0.06 225)', // deep navy-teal
      secondary: 'oklch(34% 0.02 240)', // dark ink (readable micro-labels on ivory)
      accent: 'oklch(72% 0.095 82)', // warm brass gold
      neutral: 'oklch(28% 0.02 235)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(21% 0.02 235)',
      'oklch(17% 0.018 235)',
      'oklch(13% 0.014 235)',
      'oklch(95% 0.006 90)',
    ],
    roles: {
      primary: 'oklch(72% 0.08 215)', // luminous teal
      secondary: 'oklch(80% 0.014 88)', // light ink for dark ground
      accent: 'oklch(80% 0.1 84)', // brass gold
      neutral: 'oklch(82% 0.012 88)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the consultation spine (policies, advisors + hours, the consult menu) ──
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
        'Please give us at least 48 hours’ notice to reschedule or cancel your consultation. We send a reminder two days ahead and again the day before, so the time is always easy to keep.',
    },
    {
      handle: 'planning-fee',
      name: 'Planning fee',
      depositType: 'deposit',
      depositAmountCents: 25000,
      cancellationWindowHours: 48,
      reminderOffsetsMin: [2880, 1440, 120],
      policyText:
        'Bespoke planning consultations carry a planning fee that is credited in full toward your booked trip. Reschedule with 48 hours’ notice and it carries over to your new time.',
    },
  ],
  resources: [
    {
      handle: 'elena',
      name: 'Elena Marchetti',
      kind: 'staff',
      skillTags: ['luxury', 'honeymoon', 'general'],
      windows: hours([1, 2, 3, 4, 5], 540, 1080), // Mon–Fri 9–6
    },
    {
      handle: 'marcus',
      name: 'Marcus Adeyemi',
      kind: 'staff',
      skillTags: ['experiential', 'luxury', 'general'],
      windows: hours([2, 3, 4, 5, 6], 600, 1140), // Tue–Sat 10–7
    },
    {
      handle: 'priya',
      name: 'Priya Nair',
      kind: 'staff',
      skillTags: ['family', 'luxury', 'general'],
      windows: hours([1, 3, 4, 5, 6], 570, 1050), // Mon, Wed–Sat 9:30–5:30
    },
  ],
  services: [
    {
      handle: 'discovery-call',
      name: 'Discovery call',
      description:
        'A relaxed 30-minute call to talk through where you dream of going, how you like to travel and how we can help — no fee, no obligation.',
      durationMinutes: 30,
      priceCents: 0,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'advisor', kind: 'staff', skillTags: ['general'], count: 1 }],
      policyHandle: 'consult-standard',
    },
    {
      handle: 'custom-itinerary-consult',
      name: 'Custom itinerary consultation',
      description:
        'A full planning session to shape a bespoke, day-by-day itinerary — the flights, the stays, the tables and the moments that make it yours.',
      durationMinutes: 60,
      priceCents: 25000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'advisor', kind: 'staff', skillTags: ['luxury'], count: 1 }],
      policyHandle: 'planning-fee',
    },
    {
      handle: 'honeymoon-consult',
      name: 'Honeymoon consultation',
      description:
        'Plan the trip of a lifetime for two — private villas, romantic escapes and the details handled, so all you do is arrive.',
      durationMinutes: 60,
      priceCents: 25000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'advisor', kind: 'staff', skillTags: ['honeymoon'], count: 1 }],
      policyHandle: 'planning-fee',
    },
    {
      handle: 'luxury-trip-consult',
      name: 'Luxury trip consultation',
      description:
        'For the once-in-a-decade journey — the finest suites, private guides and seamless logistics across every leg of the trip.',
      durationMinutes: 60,
      priceCents: 35000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'advisor', kind: 'staff', skillTags: ['luxury'], count: 1 }],
      policyHandle: 'planning-fee',
    },
    {
      handle: 'family-travel-consult',
      name: 'Family travel consultation',
      description:
        'Multi-generational trips that work for everyone — the right pace, the right rooms and experiences that delight all ages.',
      durationMinutes: 60,
      priceCents: 20000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'advisor', kind: 'staff', skillTags: ['family'], count: 1 }],
      policyHandle: 'planning-fee',
    },
    {
      handle: 'group-travel-consult',
      name: 'Group & celebration consultation',
      description:
        'Milestone birthdays, anniversaries and friends’ getaways — one advisor coordinating the whole party so no one is left planning.',
      durationMinutes: 45,
      priceCents: 20000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'advisor', kind: 'staff', skillTags: ['general'], count: 1 }],
      policyHandle: 'planning-fee',
    },
    {
      handle: 'vip-experience-consult',
      name: 'VIP access & experiences consultation',
      description:
        'The doors most travelers never see — private access, hard-to-get reservations and once-in-a-lifetime experiences, arranged for you.',
      durationMinutes: 45,
      priceCents: 50000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'advisor', kind: 'staff', skillTags: ['luxury'], count: 1 }],
      policyHandle: 'planning-fee',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  photoHero({
    image: url(IMG.hero),
    alt: 'An infinity pool overlooking a turquoise coastline at golden hour',
    title: 'The world, planned around you',
    sub: 'Wander & Co. is a private travel advisory for discerning travelers — bespoke itineraries, quiet luxury and access you can’t book yourself, all handled by one advisor who knows your name.',
    primary: { label: 'Book a consultation', href: '/book' },
    secondary: { label: 'See how we work', href: '/book' },
    overlay: 'dark',
  }),
  featureRow({
    items: [
      {
        title: 'Your personal travel advisor',
        body: 'One dedicated advisor who learns how you like to travel and plans every trip with you — not a call centre, not a booking site.',
      },
      {
        title: 'Bespoke itineraries, start to finish',
        body: 'Every journey is built from scratch around you — the stays, the routes, the tables and the timing, considered down to the detail.',
      },
      {
        title: 'VIP access & perks',
        body: 'Room upgrades, private guides and reservations most travelers never reach, through relationships built over years.',
      },
      {
        title: '24/7 support while you travel',
        body: 'A missed connection, a change of plan, a late-night question — we’re a message away, wherever you are in the world.',
      },
    ],
  }),
  serviceMenu({
    heading: 'Ways we can help',
    intro: 'Start with a complimentary discovery call, or go straight to the planning session that fits your trip. Full details and live availability are on the booking page.',
    surface: 'muted',
    columns: 2,
    items: [
      { name: 'Discovery call', priceCents: 0, durationMin: 30, desc: 'A no-obligation call to talk through your travel dreams.' },
      { name: 'Custom itinerary consultation', priceCents: 25000, durationMin: 60, desc: 'A full session to shape your bespoke, day-by-day trip.' },
      { name: 'Honeymoon consultation', priceCents: 25000, durationMin: 60, desc: 'The trip of a lifetime for two, handled end to end.' },
      { name: 'Luxury trip consultation', priceCents: 35000, durationMin: 60, desc: 'The once-in-a-decade journey, planned to perfection.' },
    ],
    cta: { label: 'See everything & book', href: '/book' },
  }),
  galleryStrip({
    heading: 'Where we send our travelers',
    surface: 'base',
    columns: 3,
    images: [
      { src: url(IMG.dest1), alt: 'White cliffside villages above the Aegean Sea' },
      { src: url(IMG.dest2), alt: 'Elephants crossing a golden savanna at dusk' },
      { src: url(IMG.dest3), alt: 'A quiet temple garden framed by autumn maples in Kyoto' },
      { src: url(IMG.dest4), alt: 'A chalet terrace facing snow-capped alpine peaks' },
      { src: url(IMG.dest5), alt: 'An overwater villa on a still lagoon at sunrise' },
      { src: url(IMG.dest6), alt: 'A pastel coastal town tumbling toward the Mediterranean' },
    ],
  }),
  splitFeature({
    image: url(IMG.planning),
    alt: 'A travel advisor mapping a route over open guidebooks and a world map',
    heading: 'Bespoke, from the first conversation',
    body: [
      'We don’t sell packages. Every trip begins with a conversation — how you like to move, what you want to feel, the pace that suits you — and grows into an itinerary built entirely around you.',
      'Then we handle it all: the flights and transfers, the right rooms, the reservations worth having and the small touches waiting when you arrive. You travel; we take care of the rest.',
    ],
    cta: { label: 'Start planning', href: '/book' },
    surface: 'muted',
  }),
  testimonial({
    quote: 'Elena planned three weeks across Japan for our anniversary and it was flawless — the ryokan, a private tea ceremony, a table we could never have got ourselves. It was the trip of a lifetime, and we never once had to worry.',
    attribution: 'Catherine & David, traveled 2025',
  }),
  bookingCta({
    title: 'Let’s plan somewhere unforgettable',
    sub: 'Start with a complimentary discovery call. Pick an advisor and a time that suits you — it takes about a minute.',
    cta: { label: 'Book a consultation', href: '/book' },
  }),
];

const BOOK_INTRO = [
  photoHero({
    image: url(IMG.dest5),
    alt: 'An overwater villa on a still lagoon at sunrise',
    title: 'Book a consultation',
    sub: 'Choose the conversation that fits your trip, pick your advisor and see live availability. Discovery calls are always complimentary.',
    primary: { label: 'See consultations below', href: '/book' },
    overlay: 'darker',
    align: 'start',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.hero),
    alt: 'An infinity pool overlooking a turquoise coastline at golden hour',
    heading: 'About Wander & Co.',
    body: [
      'Wander & Co. began with a simple belief: the best trips aren’t booked, they’re planned — by someone who listens, knows the world first-hand, and cares how it turns out.',
      'We’re a small advisory by design. Fewer travelers, more attention, and the kind of relationships with hotels and guides that quietly open doors. Every journey we plan is bespoke, and every traveler is someone we come to know.',
    ],
    cta: { label: 'Book a consultation', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'How we work',
    items: [
      { title: 'We listen first', body: 'Every plan starts with your story — where you’ve been, what moved you, and what you’re dreaming of next.' },
      { title: 'We design it around you', body: 'A bespoke itinerary built from scratch, refined with you until every day feels right.' },
      { title: 'We’re with you throughout', body: 'From the first idea to the trip home, one advisor and round-the-clock support have you covered.' },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Reach the studio',
    address: ['Wander & Co. Travel', '412 Harbour View', 'Suite 30 · Charleston, SC 29401'],
    mapLocation: '412 Harbour View, Charleston, SC 29401',
    hours: [
      { day: 'Monday – Friday', time: '9:00 – 6:00' },
      { day: 'Saturday', time: '10:00 – 4:00' },
      { day: 'Sunday', time: 'By appointment' },
    ],
  }),
  bookingCta({
    title: 'Rather begin online?',
    sub: 'Book a complimentary discovery call and see live availability — no phone tag, no pressure.',
    surface: 'muted',
    cta: { label: 'Book a consultation', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-travel-luxe',
  name: 'Travel Advisory (Luxury)',
  summary:
    'A refined, editorial travel-advisory site — a deep navy-teal palette, a warm brass accent and an elegant serif display over ivory, with worldly destination photography carrying the page. Installs a working consultation-booking flow: a real menu of consult types (discovery call, custom itineraries, honeymoons, luxury and VIP trips), three travel advisors you book by name with their own hours, and a planning-fee deposit policy. Ships as "Wander & Co. Travel", a luxury bespoke travel studio.',
  tagline: 'A refined template for luxury travel advisories — book consultations online from day one.',
  industry: 'Travel',
  sortWeight: 16,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'Wander & Co. Travel', tagline: 'The world, planned around you.' },
  theme: wander,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Wander & Co. Travel — a luxury bespoke travel advisory',
      description:
        'Wander & Co. is a private travel advisory for discerning travelers — bespoke itineraries, honeymoons, luxury trips and VIP access. Book a consultation online.',
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
