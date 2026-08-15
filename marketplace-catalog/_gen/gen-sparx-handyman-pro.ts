// sparx-handyman-pro — "Ace & Able Handyman", a dependable, established home-repair pro.
//
// The trusted-neighbourhood handyman: the one you call for anything and it just gets
// done. A sturdy navy-and-amber palette on an off-white ground, a solid slab display over
// a plain humanist sans, and photo-led proof of real work. Deliberately the OPPOSITE of
// the modern on-demand handyman template (bright, app-like, book-in-two-taps) — this is
// the established, skilled, one-call-fixes-it-all sibling, built on the same booking spine.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-handyman-pro.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-handyman-pro/**" \
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
  hero: 'handyman-pro-hero',
  workshop: 'handyman-pro-workshop',
  mike: 'handyman-pro-mike',
  carlos: 'handyman-pro-carlos',
  dave: 'handyman-pro-dave',
} as const;

const PHOTO: Record<string, string> = {
  "aceable-hero": "https://images.unsplash.com/photo-1562259929-b4e1fd3aef09?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8aGFuZHltYW4lMjBob21lJTIwcmVwYWlyfGVufDB8MHx8fDE3ODYzOTI2MTV8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "aceable-workshop": "https://images.unsplash.com/photo-1426927308491-6380b6a9936f?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dG9vbHMlMjB3b3Jrc2hvcCUyMHdvb2R8ZW58MHwwfHx8MTc4NjM5MjYxOHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "aceable-mike": "https://images.unsplash.com/photo-1461938337379-4b537cd2db74?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8aGFuZHltYW4lMjBwb3J0cmFpdCUyMG1hbnxlbnwwfDB8fHwxNzg2MzkyNjIxfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "aceable-carlos": "https://images.unsplash.com/reserve/oIpwxeeSPy1cnwYpqJ1w_Dufer%20Collateral%20test.jpg?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29ya2VyJTIwcG9ydHJhaXQlMjB0b29sc3xlbnwwfDB8fHwxNzg2MzkyNjI0fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "aceable-dave": "https://images.unsplash.com/photo-1621905252507-b35492cc74b4?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y29udHJhY3RvciUyMHBvcnRyYWl0JTIwbWFufGVufDB8MHx8fDE3ODYzOTI2Mjd8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (seed: string): string =>
  PHOTO[seed] ?? `https://picsum.photos/seed/${seed}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}
const ASSETS: Asset[] = [
  { id: IMG.hero, url: src('aceable-hero'), alt: 'A handyman fitting a cabinet in a bright home kitchen' },
  { id: IMG.workshop, url: src('aceable-workshop'), alt: 'A tidy van and tool wall ready for the day’s jobs' },
  { id: IMG.mike, url: src('aceable-mike'), alt: 'Mike Alvarez, lead handyman' },
  { id: IMG.carlos, url: src('aceable-carlos'), alt: 'Carlos Reyes, drywall & paint specialist' },
  { id: IMG.dave, url: src('aceable-dave'), alt: 'Dave Whitfield, install & mounting specialist' },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-handyman-pro: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "aceable": off-white ground, deep-navy primary, amber accent, slate secondary ─
const aceable = defineTheme({
  name: 'aceable',
  type: { body: face('Inter', 'sans-serif'), head: face('Archivo', 'sans-serif') },
  shape: { selector: '0.25rem', field: '0.25rem', box: '0.375rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(98% 0.004 250)', // off-white
      'oklch(95% 0.006 252)', // pale slate
      'oklch(90% 0.009 252)', // hairline
      'oklch(24% 0.02 255)', // deep slate ink
    ],
    roles: {
      primary: 'oklch(45% 0.13 255)', // deep navy
      secondary: 'oklch(34% 0.02 255)', // dark slate — readable micro-labels on the light ground
      accent: 'oklch(70% 0.16 55)', // warm amber
      neutral: 'oklch(28% 0.015 255)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(22% 0.02 255)',
      'oklch(18% 0.016 255)',
      'oklch(14% 0.012 255)',
      'oklch(95% 0.005 250)',
    ],
    roles: {
      primary: 'oklch(72% 0.11 255)', // lifted navy for dark ground
      secondary: 'oklch(82% 0.015 255)',
      accent: 'oklch(76% 0.15 58)',
      neutral: 'oklch(85% 0.01 255)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the booking spine (policy, handymen + hours, the visit menu) ───────────
const hours = (days: number[], startMinute: number, endMinute: number) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

const SCHEDULING = {
  policies: [
    {
      handle: 'handyman-standard',
      name: 'Standard visit',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [1440, 120],
      policyText:
        'Need to change your visit? Just give us 24 hours’ notice and we’ll move it, no charge. We text a reminder the day before and again two hours out, so nobody’s waiting on a doorstep.',
    },
  ],
  resources: [
    {
      handle: 'mike',
      name: 'Mike Alvarez',
      kind: 'staff',
      skillTags: ['repair', 'carpentry', 'general'],
      windows: hours([1, 2, 3, 4, 5], 420, 1020), // Mon–Fri 7–5
    },
    {
      handle: 'carlos',
      name: 'Carlos Reyes',
      kind: 'staff',
      skillTags: ['drywall', 'paint', 'general'],
      windows: hours([1, 2, 3, 4, 5, 6], 480, 1020), // Mon–Sat 8–5
    },
    {
      handle: 'dave',
      name: 'Dave Whitfield',
      kind: 'staff',
      skillTags: ['install', 'mounting', 'general'],
      windows: hours([2, 3, 4, 5, 6], 480, 1080), // Tue–Sat 8–6
    },
  ],
  services: [
    {
      handle: 'free-estimate',
      name: 'Free estimate',
      description:
        'We come out, look at the job and give you an honest, written price before any work starts. No charge, no pressure.',
      durationMinutes: 30,
      priceCents: 0,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'handyman', kind: 'staff', skillTags: ['general'], count: 1 }],
      policyHandle: 'handyman-standard',
    },
    {
      handle: 'handyman-hour',
      name: 'Handyman hour',
      description:
        'One hour with a skilled pro for the small stuff — a wobbly rail, a sticking door, a leaky faucet, that shelf that never went up.',
      durationMinutes: 60,
      priceCents: 9500,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'handyman', kind: 'staff', skillTags: ['general'], count: 1 }],
      policyHandle: 'handyman-standard',
    },
    {
      handle: 'tv-mounting',
      name: 'TV mounting',
      description:
        'We hang the TV level and solid, hide the cables and set it where you want it — bracket and hardware included.',
      durationMinutes: 90,
      priceCents: 14900,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'handyman', kind: 'staff', skillTags: ['general'], count: 1 }],
      policyHandle: 'handyman-standard',
    },
    {
      handle: 'furniture-assembly',
      name: 'Furniture assembly',
      description:
        'Flat-pack, crib, desk or wardrobe — assembled right, squared up and anchored to the wall if it needs it.',
      durationMinutes: 60,
      priceCents: 8900,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'handyman', kind: 'staff', skillTags: ['general'], count: 1 }],
      policyHandle: 'handyman-standard',
    },
    {
      handle: 'drywall-repair',
      name: 'Drywall repair',
      description:
        'Holes, dents and cracks patched, sanded smooth and blended in — ready to paint, or we can paint it to match.',
      durationMinutes: 120,
      priceCents: 19900,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'handyman', kind: 'staff', skillTags: ['general'], count: 1 }],
      policyHandle: 'handyman-standard',
    },
    {
      handle: 'home-repair-visit',
      name: 'Home repair visit',
      description:
        'A booked visit for a specific fix — a repair, a swap, an install. Tell us what’s wrong and we bring the right tools.',
      durationMinutes: 60,
      priceCents: 11900,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'handyman', kind: 'staff', skillTags: ['general'], count: 1 }],
      policyHandle: 'handyman-standard',
    },
    {
      handle: 'honey-do-half-day',
      name: 'Honey-do half day',
      description:
        'Four hours to knock out the whole list in one go — hang, patch, tighten, mount, swap. Bring the list, we bring the van.',
      durationMinutes: 240,
      priceCents: 34900,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'handyman', kind: 'staff', skillTags: ['general'], count: 1 }],
      policyHandle: 'handyman-standard',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  photoHero({
    image: url(IMG.hero),
    alt: 'A handyman fitting a cabinet in a bright home kitchen',
    title: 'One call fixes it all',
    sub: 'The repairs, installs and half-finished projects piling up around the house — handled by one skilled pro who shows up on time and does it right the first time.',
    primary: { label: 'Book a visit', href: '/book' },
    secondary: { label: 'Get a free estimate', href: '/book' },
    overlay: 'dark',
  }),
  featureRow({
    items: [
      {
        title: 'One pro for any job',
        body: 'No juggling three tradespeople for three small jobs. One skilled handyman handles the whole list in a single visit.',
      },
      {
        title: 'Upfront pricing',
        body: 'You get a clear price before we start, not a surprise at the end. What we quote is what you pay.',
      },
      {
        title: 'Licensed & insured',
        body: 'Fully licensed and insured, so the person working in your home is covered — and so are you.',
      },
      {
        title: 'Work guaranteed',
        body: 'We stand behind every job. If something isn’t right, we come back and make it right. Simple as that.',
      },
    ],
  }),
  serviceMenu({
    heading: 'What we come out for',
    intro: 'The jobs we get called for most. Every price and live availability is on the booking page — and the first estimate is always free.',
    surface: 'muted',
    columns: 2,
    items: [
      { name: 'Free estimate', priceCents: 0, durationMin: 30, desc: 'An honest, written price before any work starts.' },
      { name: 'Handyman hour', priceCents: 9500, durationMin: 60, desc: 'A skilled pro for an hour of small fixes.' },
      { name: 'TV mounting', priceCents: 14900, durationMin: 90, desc: 'Level, solid, cables tucked away.' },
      { name: 'Drywall repair', priceCents: 19900, durationMin: 120, desc: 'Holes and cracks patched and blended in.' },
      { name: 'Furniture assembly', priceCents: 8900, durationMin: 60, desc: 'Flat-pack built right and anchored.' },
      { name: 'Honey-do half day', priceCents: 34900, durationMin: 240, desc: 'The whole list, knocked out in one go.' },
    ],
    cta: { label: 'See everything & book', href: '/book' },
  }),
  splitFeature({
    image: url(IMG.workshop),
    alt: 'A tidy van and tool wall ready for the day’s jobs',
    heading: 'No job too small',
    body: [
      'A lot of pros won’t bother with a loose hinge or a single shelf. We will. The small stuff is exactly what piles up — and exactly what we’re here for.',
      'Ace & Able has been fixing homes in this town for years. Same faces, same trucks, same promise: we show up when we say we will, we clean up after ourselves, and we don’t leave until it’s done right.',
    ],
    cta: { label: 'Book a visit', href: '/book' },
  }),
  teamRow({
    heading: 'The crew you’ll meet',
    intro: 'Book the visit and one of these three shows up — every one of them a seasoned, background-checked pro.',
    members: [
      { name: 'Mike Alvarez', role: 'Lead handyman', image: url(IMG.mike), alt: 'Mike Alvarez, lead handyman', bio: 'Twenty years of repairs and carpentry. If it can be fixed, Mike’s fixed one before.' },
      { name: 'Carlos Reyes', role: 'Drywall & paint', image: url(IMG.carlos), alt: 'Carlos Reyes, drywall & paint specialist', bio: 'Patches you can’t find afterward and paint lines you could measure with a level.' },
      { name: 'Dave Whitfield', role: 'Installs & mounting', image: url(IMG.dave), alt: 'Dave Whitfield, install & mounting specialist', bio: 'TVs, shelves, fixtures and flat-pack — mounted solid and dead level, every time.' },
    ],
  }),
  testimonial({
    quote: 'They mounted our TV, fixed two doors and hung a gallery wall in one afternoon — and swept up before they left. First time in years the honey-do list is actually empty.',
    attribution: 'Dana R., homeowner since 2022',
  }),
  bookingCta({
    title: 'Got a list? We’ve got a van.',
    sub: 'Pick what you need, see live times and book in about a minute. Not sure what it’ll cost? Start with a free estimate.',
    cta: { label: 'Book a visit', href: '/book' },
  }),
];

const BOOK_INTRO = [
  photoHero({
    image: url(IMG.workshop),
    alt: 'A tidy van and tool wall ready for the day’s jobs',
    title: 'Book your visit',
    sub: 'Choose what you need to see the price and live availability, then pick your day and time. First estimate’s on us.',
    primary: { label: 'See visit types below', href: '/book' },
    overlay: 'darker',
    align: 'start',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.hero),
    alt: 'A handyman fitting a cabinet in a bright home kitchen',
    heading: 'About Ace & Able',
    body: [
      'We started Ace & Able Handyman on a simple idea: most people don’t need a specialist for every little thing — they need one reliable pro who can do a bit of everything and actually turns up.',
      'That’s us. Repairs, installs, drywall, carpentry, mounting, the endless honey-do list — one call, one trusted crew, one price you agreed to up front. No run-around, no mess left behind.',
    ],
    cta: { label: 'Book a visit', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'How we work',
    items: [
      { title: 'A real estimate first', body: 'We look at the job in person and give you a clear, written price before we pick up a tool — and the estimate is always free.' },
      { title: 'The right pro for the job', body: 'Repairs, drywall or installs, we send the person who does that work every day. You always get a skilled hand, not a guess.' },
      { title: 'Cleaned up and guaranteed', body: 'We tidy up before we go and stand behind the work. If something’s not right, we come back and fix it — no argument.' },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Where to find us',
    address: ['Ace & Able Handyman', '412 Maple Avenue', 'Bay 3 · Springfield, OR 97477'],
    mapLocation: '412 Maple Avenue, Springfield, OR 97477',
    hours: [
      { day: 'Monday – Friday', time: '7:00 – 5:00' },
      { day: 'Saturday', time: '8:00 – 6:00' },
      { day: 'Sunday', time: 'Closed' },
    ],
  }),
  bookingCta({
    title: 'Rather book than call?',
    sub: 'See live availability and lock in your visit online — no phone tag, no waiting on a callback.',
    surface: 'muted',
    cta: { label: 'Book a visit', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-handyman-pro',
  name: 'Handyman (Pro)',
  summary:
    'A dependable handyman site — a sturdy navy-and-amber palette on an off-white ground with a solid slab display, photo-led throughout. Installs a working booking flow: a real visit menu (free estimates, TV mounting, furniture assembly, drywall repair, half-day honey-do lists), three handymen dispatched by skill with their own hours, and a 24-hour reschedule policy. Ships as "Ace & Able Handyman", an all-around home-repair pro where one call fixes it all.',
  tagline: 'A dependable template for handyman & home-repair pros — book visits online from day one.',
  industry: 'Handyman',
  sortWeight: 42,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'Ace & Able Handyman', tagline: 'One call fixes it all.' },
  theme: aceable,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Ace & Able Handyman — home repairs & installs',
      description:
        'Ace & Able Handyman handles repairs, installs, drywall, mounting and honey-do lists — one skilled, licensed pro who shows up on time. Book a visit or a free estimate online.',
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
