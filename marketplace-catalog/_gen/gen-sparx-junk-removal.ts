// sparx-junk-removal — "Haul Away Junk Removal", a friendly, fast junk & debris company.
//
// The easy, everyday, we-do-the-heavy-lifting hauler of the trades research (the 1-800
// lane, made friendly): a clean off-white ground, a confident green primary, a warm
// orange accent and a dark, readable secondary for micro-labels — bold and approachable,
// sturdy friendly sans. Furniture & appliance removal, garage & estate cleanouts,
// construction debris, same-day pickup. The functional core is BOOKING A FREE QUOTE /
// PICKUP — homeowners book a free, no-obligation quote or a pickup online and get a real
// time slot. Deliberately the FAST, friendly, everyday sibling of the separate
// eco/donation-focused junk template — same booking spine, a different personality.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-junk-removal.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-junk-removal/**" \
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
  hero: 'junk-removal-hero',
  story: 'junk-removal-story',
  jesse: 'junk-removal-jesse',
  marta: 'junk-removal-marta',
  tyrell: 'junk-removal-tyrell',
} as const;

const PHOTO: Record<string, string> = {
  "haulaway-hero": "https://images.unsplash.com/photo-1614359835514-92f8ba196357?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bW92aW5nJTIwdHJ1Y2slMjBsb2FkaW5nfGVufDB8MHx8fDE3ODYzOTU3MDV8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "haulaway-story": "https://images.unsplash.com/photo-1614359835514-92f8ba196357?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29ya2VycyUyMG1vdmluZyUyMGZ1cm5pdHVyZXxlbnwwfDB8fHwxNzg2Mzk1NzA3fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "haulaway-jesse": "https://images.unsplash.com/photo-1530983822321-fcac2d3c0f06?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29ya2VyJTIwcG9ydHJhaXQlMjBtYW58ZW58MHwwfHx8MTc4NjM5NTcxMHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "haulaway-marta": "https://images.unsplash.com/photo-1615464670798-6e92fafa2a89?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjB3b3JrZXIlMjBwb3J0cmFpdHxlbnwwfDB8fHwxNzg2Mzg4MjQwfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "haulaway-tyrell": "https://images.unsplash.com/flagged/photo-1570612861542-284f4c12e75f?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bW92ZXIlMjBwb3J0cmFpdCUyMG1hbnxlbnwwfDB8fHwxNzg2Mzk1NzE0fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
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
    url: src('haulaway-hero'),
    alt: 'A friendly two-person crew loading an old couch into a junk-removal truck',
  },
  {
    id: IMG.story,
    url: src('haulaway-story'),
    alt: 'A cleared-out garage swept clean after a junk pickup',
  },
  { id: IMG.jesse, url: src('haulaway-jesse'), alt: 'Jesse Park, crew lead' },
  { id: IMG.marta, url: src('haulaway-marta'), alt: 'Marta Nunez, furniture & appliance crew' },
  { id: IMG.tyrell, url: src('haulaway-tyrell'), alt: 'Tyrell Woods, debris & cleanout crew' },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-junk-removal: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "haulaway": off-white ground, confident green, warm orange accent, dark ink ─
const haulaway = defineTheme({
  name: 'haulaway',
  type: { body: face('Inter', 'sans-serif'), head: face('Archivo', 'sans-serif') },
  shape: { selector: '0.5rem', field: '0.5rem', box: '0.75rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(98% 0.006 140)', // clean off-white ground
      'oklch(94% 0.01 145)', // cool paper
      'oklch(89% 0.014 150)', // hairline
      'oklch(24% 0.03 155)', // deep green-black ink
    ],
    roles: {
      primary: 'oklch(53% 0.13 150)', // confident green
      secondary: 'oklch(32% 0.02 155)', // dark slate-green (readable micro-labels on light)
      accent: 'oklch(72% 0.16 55)', // warm orange
      neutral: 'oklch(28% 0.02 155)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(22% 0.02 155)',
      'oklch(18% 0.018 155)',
      'oklch(14% 0.015 155)',
      'oklch(95% 0.006 140)',
    ],
    roles: {
      primary: 'oklch(72% 0.14 150)', // lifted grass-green
      secondary: 'oklch(78% 0.02 150)',
      accent: 'oklch(77% 0.15 58)',
      neutral: 'oklch(82% 0.02 150)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the booking spine (policies, crews + hours, the quote/pickup menu) ────
const hours = (days: number[], startMinute: number, endMinute: number) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

const SCHEDULING = {
  policies: [
    {
      handle: 'haul-standard',
      name: 'Standard pickup',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [1440, 120],
      policyText:
        'Give us at least 24 hours’ notice to move or cancel a pickup. We text a reminder the day before and let you know when the crew is on the way.',
    },
    {
      handle: 'sameday-priority',
      name: 'Same-day priority',
      depositType: 'none',
      cancellationWindowHours: 2,
      reminderOffsetsMin: [120],
      policyText:
        'Same-day pickups go to the first available crew. We confirm your arrival window by text so you’re never left guessing when we’ll show.',
    },
  ],
  resources: [
    {
      handle: 'jesse-crew',
      name: 'Jesse’s Crew',
      kind: 'staff',
      skillTags: ['pickup', 'cleanout', 'general'],
      windows: hours([1, 2, 3, 4, 5, 6], 420, 1080), // Mon–Sat 7–6
    },
    {
      handle: 'marta-crew',
      name: 'Marta’s Crew',
      kind: 'staff',
      skillTags: ['furniture', 'appliance', 'general'],
      windows: hours([1, 2, 3, 4, 5], 480, 1020), // Mon–Fri 8–5
    },
    {
      handle: 'tyrell-crew',
      name: 'Tyrell’s Crew',
      kind: 'staff',
      skillTags: ['debris', 'cleanout', 'general'],
      windows: hours([2, 3, 4, 5, 6], 480, 1080), // Tue–Sat 8–6
    },
  ],
  services: [
    {
      handle: 'free-quote',
      name: 'Free quote',
      description:
        'We swing by, look at your pile and give you a flat, upfront price on the spot — no charge, no obligation, no pressure.',
      durationMinutes: 30,
      priceCents: 0,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'crew', kind: 'staff', skillTags: ['general'], count: 1 },
      ],
      policyHandle: 'haul-standard',
    },
    {
      handle: 'single-item-pickup',
      name: 'Single-item pickup',
      description:
        'One bulky item gone — a mattress, a couch, a treadmill or that fridge in the garage. We carry it out, you point.',
      durationMinutes: 30,
      priceCents: 7900,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'crew', kind: 'staff', skillTags: ['general'], count: 1 },
      ],
      policyHandle: 'haul-standard',
    },
    {
      handle: 'furniture-appliance-removal',
      name: 'Furniture & appliance removal',
      description:
        'Old sofas, dressers, washers, dryers and fridges hauled out of any room — up or down stairs, no scratched walls.',
      durationMinutes: 60,
      priceCents: 12900,
      bufferAfterMin: 15,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'crew', kind: 'staff', skillTags: ['general'], count: 1 },
      ],
      policyHandle: 'haul-standard',
    },
    {
      handle: 'garage-cleanout',
      name: 'Garage cleanout',
      description:
        'A whole garage cleared in one visit — boxes, bikes, broken tools and the pile you’ve been stepping around for years.',
      durationMinutes: 120,
      priceCents: 29900,
      bufferAfterMin: 15,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'crew', kind: 'staff', skillTags: ['general'], count: 1 },
      ],
      policyHandle: 'haul-standard',
    },
    {
      handle: 'estate-cleanout-consult',
      name: 'Estate cleanout consult',
      description:
        'A full-property cleanout, handled with care. We come out, walk it with you and put together a plan and a flat price — free.',
      durationMinutes: 45,
      priceCents: 0,
      requiresApproval: true,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'crew', kind: 'staff', skillTags: ['general'], count: 1 },
      ],
      policyHandle: 'haul-standard',
    },
    {
      handle: 'construction-debris-removal',
      name: 'Construction debris removal',
      description:
        'Post-project cleanup — drywall, lumber, flooring, tile and remodel debris loaded up and hauled off so you can hand over a clean site.',
      durationMinutes: 120,
      priceCents: 34900,
      bufferAfterMin: 15,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'crew', kind: 'staff', skillTags: ['general'], count: 1 },
      ],
      policyHandle: 'haul-standard',
    },
    {
      handle: 'same-day-pickup',
      name: 'Same-day pickup',
      description:
        'Need it gone today? We dispatch the first available crew and text your arrival window — usually within a few hours.',
      durationMinutes: 60,
      priceCents: 14900,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'crew', kind: 'staff', skillTags: ['general'], count: 1 },
      ],
      policyHandle: 'sameday-priority',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  photoHero({
    image: url(IMG.hero),
    alt: 'A friendly two-person crew loading an old couch into a junk-removal truck',
    title: 'Junk gone. We do the heavy lifting.',
    sub: 'Furniture, appliances, garage and estate cleanouts, construction debris — hauled away fast and friendly. Book a free quote online and we’ll give you a flat price before we lift a thing.',
    primary: { label: 'Book a free quote', href: '/book' },
    secondary: { label: 'See what we haul', href: '/book' },
    overlay: 'dark',
  }),
  featureRow({
    items: [
      {
        title: 'Upfront, volume-based pricing',
        body: 'You pay for the space your stuff takes in the truck — quoted flat and in writing before we start. No hourly meter, no surprises at the curb.',
      },
      {
        title: 'Same-day & next-day',
        body: 'Book today and there’s a good chance we’re there today. Pick a window online and we’ll text you when the crew is on the way.',
      },
      {
        title: 'We lift & haul it all',
        body: 'You point, we carry. Up the stairs, out of the basement, off the back deck — our crew does every bit of the heavy lifting.',
      },
      {
        title: 'We sweep up after',
        body: 'We don’t just take the junk. We tidy the space, sweep up behind us and leave the spot cleaner than we found it.',
      },
    ],
  }),
  serviceMenu({
    heading: 'What we haul away',
    intro: 'The pickups we book most. Pick one to see the flat price, how long it takes and the next open time.',
    surface: 'muted',
    columns: 2,
    items: [
      {
        name: 'Free quote',
        priceCents: 0,
        durationMin: 30,
        desc: 'A flat, no-charge price before anything moves.',
      },
      {
        name: 'Single-item pickup',
        priceCents: 7900,
        durationMin: 30,
        desc: 'One bulky item — mattress, couch or old fridge.',
      },
      {
        name: 'Furniture & appliance removal',
        priceCents: 12900,
        durationMin: 60,
        desc: 'Sofas, dressers, washers and fridges hauled out.',
      },
      {
        name: 'Garage cleanout',
        priceCents: 29900,
        durationMin: 120,
        desc: 'A whole garage cleared in a single visit.',
      },
    ],
    cta: { label: 'See everything & book', href: '/book' },
  }),
  splitFeature({
    image: url(IMG.story),
    alt: 'A cleared-out garage swept clean after a junk pickup',
    heading: 'Getting rid of it is this easy',
    body: [
      'One — book a free quote online in about a minute. Two — we show up in the window we promised, size up your pile and hand you a flat price on the spot.',
      'Three — say the word and it’s gone. We load it, sweep up and haul it off, all in the same visit. You point at the pile; we do the rest.',
    ],
    cta: { label: 'Book your free quote', href: '/book' },
  }),
  teamRow({
    heading: 'The crew showing up at your door',
    intro: 'Friendly, background-checked and in uniform — the same folks who’ll carry it out and sweep up after.',
    members: [
      {
        name: 'Jesse Park',
        role: 'Crew lead',
        image: url(IMG.jesse),
        alt: 'Jesse Park, crew lead',
        bio: 'Runs the schedule and most pickups. Jesse’s the one who gives you the straight quote and gets it loaded fast.',
      },
      {
        name: 'Marta Nunez',
        role: 'Furniture & appliance crew',
        image: url(IMG.marta),
        alt: 'Marta Nunez, furniture & appliance crew',
        bio: 'Heavy sofas, fridges and washers down tight stairwells without a mark on the wall — that’s Marta’s specialty.',
      },
      {
        name: 'Tyrell Woods',
        role: 'Debris & cleanout crew',
        image: url(IMG.tyrell),
        alt: 'Tyrell Woods, debris & cleanout crew',
        bio: 'Garage, estate and construction cleanouts. Tyrell clears the big jobs and leaves the space swept and ready.',
      },
    ],
  }),
  testimonial({
    quote: 'They quoted me a flat price in five minutes, had a garage full of junk loaded in under an hour, and swept the floor before they left. Booked it that morning, gone by lunch. Unreal.',
    attribution: 'Dana R., homeowner',
  }),
  bookingCta({
    title: 'Got a pile that needs to go? Let’s haul it.',
    sub: 'Book a free quote or a pickup online in about a minute. Pick a day, and we’ll confirm your window.',
    cta: { label: 'Book a free quote', href: '/book' },
  }),
];

const BOOK_INTRO = [
  photoHero({
    image: url(IMG.story),
    alt: 'A cleared-out garage swept clean after a junk pickup',
    title: 'Book a free quote or pickup',
    sub: 'Choose what you need gone to see the flat price, how long it takes and the next open time — then pick your crew and day.',
    primary: { label: 'See services below', href: '/book' },
    overlay: 'darker',
    align: 'start',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.hero),
    alt: 'A friendly two-person crew loading an old couch into a junk-removal truck',
    heading: 'About Haul Away',
    body: [
      'We started Haul Away to make getting rid of stuff the easy part of your day. Show up on time, quote an honest flat price, do all the lifting, and leave the space cleaner than we found it.',
      'We’re a friendly, local crew that hauls furniture, appliances, garage and estate cleanouts and construction debris — for homeowners, landlords, contractors and anyone with a pile that needs to disappear. No hourly meter, no upsells, no runaround.',
    ],
    cta: { label: 'Book a free quote', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'How we work',
    items: [
      {
        title: 'A flat price first',
        body: 'We look at the job, quote the space it takes in the truck, and hand you a flat written price. Nothing moves until you say go.',
      },
      {
        title: 'All the heavy lifting',
        body: 'You never have to drag anything to the curb. We carry it out from wherever it sits — stairs, basements, back yards and all.',
      },
      {
        title: 'Clean when we leave',
        body: 'We sweep up behind us and haul everything off in the same visit. You’re left with an empty, tidy space and nothing to deal with.',
      },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Where we work & how to reach us',
    address: ['Haul Away Junk Removal', '905 Depot Avenue', 'Riverside, CA 92507'],
    mapLocation: '905 Depot Avenue, Riverside, CA 92507',
    hours: [
      { day: 'Monday – Friday', time: '7:00 – 6:00' },
      { day: 'Saturday', time: '8:00 – 6:00' },
      { day: 'Sunday', time: 'Closed' },
      { day: 'Same-day line', time: '7 days a week' },
    ],
  }),
  bookingCta({
    title: 'Rather book than call?',
    sub: 'See the next open times and reserve your pickup online — no phone tag, no waiting on hold.',
    surface: 'muted',
    cta: { label: 'Book a free quote', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-junk-removal',
  name: 'sparx — Junk Removal',
  summary:
    'A bold, friendly junk & debris removal site — a confident green palette with a warm orange accent, off-white ground and a sturdy sans display. Installs a working online booking flow: homeowners book a free quote or a pickup and get a real time slot. Ships a full menu (free quote, single-item, furniture & appliance, garage & estate cleanouts, construction debris, same-day), three crews as dispatchable resources, and standard + same-day policies. Ships as "Haul Away Junk Removal".',
  tagline: 'A bold, friendly template for junk removal — book quotes & pickups online from day one.',
  industry: 'Junk removal',
  sortWeight: 10,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: {
    businessName: 'Haul Away Junk Removal',
    tagline: 'You point. We haul. It’s gone.',
  },
  theme: haulaway,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Haul Away Junk Removal — fast, friendly junk & debris pickup',
      description:
        'Haul Away is a friendly local junk removal crew — furniture, appliances, garage and estate cleanouts and construction debris, hauled fast with upfront flat pricing. Book a free quote or a pickup online.',
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
