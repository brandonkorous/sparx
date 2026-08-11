// sparx-handyman-modern — "FixList", a modern, on-demand HANDYMAN service.
//
// The bright, techy sibling to the established-pro handyman template (navy, photo-led,
// heritage-trust). This one leads with SPEED and TRANSPARENCY: book a vetted pro online
// in minutes, flat hourly rates, live scheduling — for busy homeowners and renters who
// want the whole thing handled from their phone. A vivid teal primary, a warm amber
// accent and a crisp near-white ground carry a friendly, fast, on-demand feel; a
// type-first hero and a "how it works" three-step row make the model obvious at a glance.
// Same booking spine as the rest of the service family, a deliberately different business.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-handyman-modern.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-handyman-modern/**" \
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
  serviceMenu,
  splitFeature,
  STATUS_ON_DARK,
  STATUS_ON_LIGHT,
  teamRow,
  testimonial,
  typeHero,
  type ServiceSiteSpec,
} from './service-sites/harness';

// ── Imagery (swap-ready; each id also names an entry in ASSETS) ────────────────────
const IMG = {
  pricing: 'handyman-modern-pricing',
  about: 'handyman-modern-about',
  marcus: 'handyman-modern-marcus',
  diego: 'handyman-modern-diego',
  tasha: 'handyman-modern-tasha',
} as const;

const PHOTO: Record<string, string> = {
  "fixlist-pricing": "https://images.unsplash.com/reserve/oIpwxeeSPy1cnwYpqJ1w_Dufer%20Collateral%20test.jpg?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8aG9tZSUyMGltcHJvdmVtZW50JTIwdG9vbHN8ZW58MHwwfHx8MTc4NjM5MjYzMHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "fixlist-about": "https://images.unsplash.com/photo-1562259929-b4e1fd3aef09?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8aGFuZHltYW4lMjB3b3JraW5nJTIwaG9tZXxlbnwwfDB8fHwxNzg2MzkyNjMyfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "fixlist-marcus": "https://images.unsplash.com/photo-1530983822321-fcac2d3c0f06?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29ya2VyJTIwcG9ydHJhaXQlMjBtYW58ZW58MHwwfHx8MTc4NjM4ODIzNnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "fixlist-diego": "https://images.unsplash.com/photo-1461938337379-4b537cd2db74?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8aGFuZHltYW4lMjBwb3J0cmFpdHxlbnwwfDB8fHwxNzg2MzkyNjM3fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "fixlist-tasha": "https://images.unsplash.com/photo-1615464670798-6e92fafa2a89?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjB3b3JrZXIlMjBwb3J0cmFpdHxlbnwwfDB8fHwxNzg2MzkyNjQwfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
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
    id: IMG.pricing,
    url: src('fixlist-pricing'),
    alt: 'A pro checking a booking on a phone before starting a job',
  },
  {
    id: IMG.about,
    url: src('fixlist-about'),
    alt: 'A tidy tool bag and cordless drill on a kitchen counter',
  },
  { id: IMG.marcus, url: src('fixlist-marcus'), alt: 'Marcus Reed, repair and install pro' },
  { id: IMG.diego, url: src('fixlist-diego'), alt: 'Diego Alvarez, mounting and assembly pro' },
  { id: IMG.tasha, url: src('fixlist-tasha'), alt: 'Tasha Brooks, drywall and paint pro' },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-handyman-modern: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "fixlist": crisp near-white ground, vivid teal primary, warm amber accent ─
const fixlist = defineTheme({
  name: 'fixlist',
  type: { body: face('Inter', 'sans-serif'), head: face('Space Grotesk', 'sans-serif') },
  shape: { selector: '0.625rem', field: '0.5rem', box: '0.75rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(99% 0.004 220)', // crisp near-white ground
      'oklch(96% 0.006 220)', // pale mist
      'oklch(91% 0.009 225)', // hairline
      'oklch(24% 0.02 255)', // deep ink
    ],
    roles: {
      primary: 'oklch(62% 0.13 195)', // vivid teal
      secondary: 'oklch(35% 0.03 255)', // dark slate — readable micro-labels on light
      accent: 'oklch(78% 0.14 72)', // warm amber
      neutral: 'oklch(26% 0.02 255)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(22% 0.02 255)',
      'oklch(18% 0.015 255)',
      'oklch(14% 0.012 255)',
      'oklch(95% 0.005 220)',
    ],
    roles: {
      primary: 'oklch(72% 0.13 195)',
      secondary: 'oklch(80% 0.02 240)',
      accent: 'oklch(82% 0.13 74)',
      neutral: 'oklch(85% 0.015 240)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the booking spine (policies, dispatchable pros + hours, the task menu) ─
const hours = (days: number[], startMinute: number, endMinute: number) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

const SCHEDULING = {
  policies: [
    {
      handle: 'fixlist-standard',
      name: 'Standard booking',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [1440, 120],
      policyText:
        'Need to change your time? Reschedule or cancel with 24 hours’ notice, free. We text a reminder the day before and two hours ahead so a pro is never a surprise.',
    },
    {
      handle: 'fixlist-project',
      name: 'Project booking',
      depositType: 'deposit',
      depositAmountCents: 5000,
      cancellationWindowHours: 48,
      reminderOffsetsMin: [2880, 1440, 120],
      policyText:
        'Half-day projects hold a $50 deposit that comes straight off your total. Reschedule with 48 hours’ notice and it carries over to your new time.',
    },
  ],
  resources: [
    {
      handle: 'marcus',
      name: 'Marcus Reed',
      kind: 'staff',
      skillTags: ['repair', 'install', 'general'],
      windows: hours([1, 2, 3, 4, 5, 6], 480, 1200), // Mon–Sat 8–8
    },
    {
      handle: 'diego',
      name: 'Diego Alvarez',
      kind: 'staff',
      skillTags: ['assembly', 'mounting', 'general'],
      windows: hours([1, 2, 3, 4, 5, 0], 540, 1260), // Mon–Fri + Sun 9–9
    },
    {
      handle: 'tasha',
      name: 'Tasha Brooks',
      kind: 'staff',
      skillTags: ['drywall', 'paint', 'general'],
      windows: hours([2, 3, 4, 5, 6, 0], 480, 1140), // Tue–Sun 8–7
    },
  ],
  services: [
    {
      handle: 'free-quote',
      name: 'Free quote visit',
      description:
        'Not sure what it’ll take? A pro stops by, sizes up the job and gives you a straight, no-obligation price. Free.',
      durationMinutes: 30,
      priceCents: 0,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'pro', kind: 'staff', skillTags: ['general'], count: 1 }],
      policyHandle: 'fixlist-standard',
    },
    {
      handle: 'quick-fix-hour',
      name: 'Quick-fix hour',
      description:
        'One hour, one pro, your short list of small stuff — a wobbly handle, a running toilet, a door that won’t latch.',
      durationMinutes: 60,
      priceCents: 9900,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'pro', kind: 'staff', skillTags: ['general'], count: 1 }],
      policyHandle: 'fixlist-standard',
    },
    {
      handle: 'tv-mounting',
      name: 'TV mounting',
      description:
        'We find the studs, hang it level, hide the cables and clean up. Bring the bracket or add one on-site.',
      durationMinutes: 90,
      priceCents: 14900,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'pro', kind: 'staff', skillTags: ['general'], count: 1 }],
      policyHandle: 'fixlist-standard',
    },
    {
      handle: 'furniture-assembly',
      name: 'Furniture assembly',
      description:
        'Flat-pack beds, shelves, desks and dressers built right the first time — packaging hauled out when we’re done.',
      durationMinutes: 120,
      priceCents: 12900,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'pro', kind: 'staff', skillTags: ['general'], count: 1 }],
      policyHandle: 'fixlist-standard',
    },
    {
      handle: 'smart-home-install',
      name: 'Smart-home install',
      description:
        'Video doorbells, smart locks, thermostats and light switches wired, set up on your phone and tested.',
      durationMinutes: 90,
      priceCents: 13900,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'pro', kind: 'staff', skillTags: ['general'], count: 1 }],
      policyHandle: 'fixlist-standard',
    },
    {
      handle: 'pick-a-task-visit',
      name: 'Pick-a-task visit',
      description:
        'Have one specific job in mind? Book a focused visit and a vetted pro shows up ready to knock it out.',
      durationMinutes: 60,
      priceCents: 8900,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'pro', kind: 'staff', skillTags: ['general'], count: 1 }],
      policyHandle: 'fixlist-standard',
    },
    {
      handle: 'half-day-project',
      name: 'Half-day project',
      description:
        'Four hours of a dedicated pro for the bigger list — a gallery wall, a closet system, a room’s worth of small repairs.',
      durationMinutes: 240,
      priceCents: 34900,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'pro', kind: 'staff', skillTags: ['general'], count: 1 }],
      policyHandle: 'fixlist-project',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  typeHero({
    title: 'Home fixed. Booked from your phone in two minutes.',
    sub: 'On-demand handymen for busy homeowners and renters. Pick the task, choose a time, and a vetted pro shows up ready to work — at a flat hourly rate you see before you book.',
    primary: { label: 'Book online', href: '/book' },
    secondary: { label: 'See tasks & prices', href: '/book' },
    surface: 'base',
  }),
  featureRow({
    heading: 'How it works',
    items: [
      {
        title: '1 · Pick your task',
        body: 'Tell us what needs doing — a mount, an assembly, a quick-fix hour of odd jobs. Every task shows the price and how long it takes up front.',
      },
      {
        title: '2 · Choose a time',
        body: 'See real, live availability — often same day, evenings and weekends included — and grab the slot that fits your day.',
      },
      {
        title: '3 · A vetted pro arrives',
        body: 'A background-checked, insured pro turns up on time with the tools, does the work, cleans up, and you pay through the app. Done.',
      },
    ],
  }),
  serviceMenu({
    heading: 'Tasks & flat prices',
    intro: 'No call-outs for a quote, no mystery add-ons. Here’s what the common jobs cost — full prices and live times are on the booking page.',
    surface: 'muted',
    columns: 2,
    items: [
      {
        name: 'Quick-fix hour',
        priceCents: 9900,
        durationMin: 60,
        desc: 'One pro, one hour, your short list of small repairs.',
      },
      {
        name: 'TV mounting',
        priceCents: 14900,
        durationMin: 90,
        desc: 'Hung level, cables hidden, mess cleaned up.',
      },
      {
        name: 'Furniture assembly',
        priceCents: 12900,
        durationMin: 120,
        desc: 'Flat-pack built right, packaging hauled away.',
      },
      {
        name: 'Smart-home install',
        priceCents: 13900,
        durationMin: 90,
        desc: 'Doorbells, locks and thermostats set up and tested.',
      },
    ],
    cta: { label: 'See every task & book', href: '/book' },
  }),
  splitFeature({
    image: url(IMG.pricing),
    alt: 'A pro checking a booking on a phone before starting a job',
    heading: 'One flat rate. Pros you can actually trust.',
    body: [
      'Every FixList pro is background-checked, insured and rated by real neighbors before they ever knock on your door. The person you book is the person who shows up.',
      'Pricing is just as simple: a clear flat rate per task, quoted before you book, charged through the app. No cash on the counter, no surprise line items, no haggling on your doorstep.',
    ],
    cta: { label: 'Book a vetted pro', href: '/book' },
  }),
  teamRow({
    heading: 'Meet a few of your pros',
    intro: 'Book by name or let us dispatch the first available — either way you get someone vetted and reviewed.',
    members: [
      {
        name: 'Marcus Reed',
        role: 'Repair & install',
        image: url(IMG.marcus),
        alt: 'Marcus Reed, repair and install pro',
        bio: 'Fifteen years of fixing what’s broken — plumbing, doors, hardware and the fiddly stuff nobody else wants.',
      },
      {
        name: 'Diego Alvarez',
        role: 'Mounting & assembly',
        image: url(IMG.diego),
        alt: 'Diego Alvarez, mounting and assembly pro',
        bio: 'The one you want for TVs, floating shelves and a flat-pack that came with forty screws and no instructions.',
      },
      {
        name: 'Tasha Brooks',
        role: 'Drywall & paint',
        image: url(IMG.tasha),
        alt: 'Tasha Brooks, drywall and paint pro',
        bio: 'Patches holes, hides dents and touches up paint so cleanly you’ll forget the mark was ever there.',
      },
    ],
  }),
  testimonial({
    quote: 'Booked a TV mount at 9am, it was on the wall by noon. Flat price, friendly pro, done. This is how everything should work.',
    attribution: 'Renee M., booked in March',
    surface: 'muted',
  }),
  bookingCta({
    title: 'Got a to-do list? Hand it over.',
    sub: 'Pick a task, choose a time and see live availability. It takes about two minutes.',
    cta: { label: 'Book online', href: '/book' },
  }),
];

const BOOK_INTRO = [
  typeHero({
    title: 'Book a pro',
    sub: 'Choose a task to see its flat price and live availability, then pick a time and your pro. Same-day slots open often.',
    primary: { label: 'See tasks below', href: '/book' },
    surface: 'muted',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.about),
    alt: 'A tidy tool bag and cordless drill on a kitchen counter',
    heading: 'The handyman, minus the hassle',
    body: [
      'FixList started with a simple frustration: getting small home jobs done meant phone tag, no-shows and a price you only heard after the work was over. So we built the opposite.',
      'Now you book online in minutes, see the flat rate before you commit, and get a vetted, insured pro at your door — often the same day. No quotes to chase, no cash to dig up, no wondering who’s showing up.',
    ],
    cta: { label: 'Book a pro', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'Why homeowners book us',
    items: [
      {
        title: 'Vetted & insured',
        body: 'Every pro is background-checked, insured and reviewed by real customers. We stand behind the work, not just the booking.',
      },
      {
        title: 'Prices you see first',
        body: 'Flat rates per task, quoted before you book and charged in the app. What you’re quoted is what you pay.',
      },
      {
        title: 'On your schedule',
        body: 'Live availability with evening and weekend slots, and free rescheduling — so a fix fits around your life, not the other way round.',
      },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Where we work',
    address: ['FixList', 'Serving the greater metro area', 'Dispatch: 210 Maker Ave, Austin, TX 78702'],
    mapLocation: '210 Maker Ave, Austin, TX 78702',
    hours: [
      { day: 'Monday – Friday', time: '8:00 – 9:00' },
      { day: 'Saturday', time: '8:00 – 8:00' },
      { day: 'Sunday', time: '9:00 – 7:00' },
      { day: 'Holidays', time: 'Limited slots' },
    ],
  }),
  bookingCta({
    title: 'Rather book than call?',
    sub: 'Skip the phone tag — see live availability and lock in a vetted pro online.',
    surface: 'muted',
    cta: { label: 'Book online', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-handyman-modern',
  name: 'sparx — Handyman (Modern)',
  summary:
    'A bright, techy handyman site for on-demand home repairs — book a vetted pro online in minutes at a flat hourly rate. Installs a working booking flow: a real task menu (mounting, assembly, smart-home, half-day projects), three vetted pros dispatched as bookable resources with long weekday and weekend hours, and same-day scheduling. Ships as "FixList", a modern on-demand handyman service.',
  tagline: 'A modern, on-demand template for handymen — booked online from day one.',
  industry: 'Handyman',
  sortWeight: 41,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'FixList', tagline: 'Home fixed, booked from your phone.' },
  theme: fixlist,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'FixList — book a vetted handyman online',
      description:
        'FixList is on-demand handyman service — mounting, assembly, smart-home installs and repairs at flat rates. Book a vetted, insured pro online in minutes.',
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
