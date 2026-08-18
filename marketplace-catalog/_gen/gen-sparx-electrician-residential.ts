// sparx-electrician-residential — "Brightwire Electric", a trustworthy RESIDENTIAL electrician.
//
// The safety-first, homeowner-reassuring electrician of the "done right and to code" lane:
// a warm-white ground, a charcoal/graphite primary, a safety-yellow accent used sparingly,
// and photo-led sections carrying real, code-compliant home electrical work. Deliberately
// the WARM sibling of the modern/commercial+EV electrician template (sleek dark + electric
// accent) — this one is warmer, calmer and built to reassure a family in their home. Same
// booking spine, a different business: the functional core is BOOKING A VISIT (a free
// estimate, a diagnostic, a service call), not a look with a static "/book" page.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @wizeworks/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-electrician-residential.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-electrician-residential/**" \
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
  teamRow,
  testimonial,
  type ServiceSiteSpec,
} from './service-sites/harness';

// ── Imagery (swap-ready; each id also names an entry in ASSETS) ────────────────────
const IMG = {
  hero: 'electrician-residential-hero',
  inspection: 'electrician-residential-inspection',
  marcus: 'electrician-residential-marcus',
  diego: 'electrician-residential-diego',
  ray: 'electrician-residential-ray',
  work1: 'electrician-residential-work1',
  work2: 'electrician-residential-work2',
  work3: 'electrician-residential-work3',
} as const;

const PHOTO: Record<string, string> = {
  "brightwire-hero": "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZWxlY3RyaWNpYW4lMjB3b3JraW5nfGVufDB8MHx8fDE3ODYzODgyNzJ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "brightwire-inspection": "https://images.unsplash.com/photo-1635335874521-7987db781153?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZWxlY3RyaWNhbCUyMHBhbmVsJTIwd2lyaW5nfGVufDB8MHx8fDE3ODYzODgyNzV8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "brightwire-marcus": "https://images.unsplash.com/photo-1621905252507-b35492cc74b4?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZWxlY3RyaWNpYW4lMjBwb3J0cmFpdCUyMG1hbnxlbnwwfDB8fHwxNzg2Mzg4Mjc4fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "brightwire-ray": "https://images.unsplash.com/photo-1759521296144-fe6f2d2dc769?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29ya2VyJTIwcG9ydHJhaXQlMjB1bmlmb3JtfGVufDB8MHx8fDE3ODYzODgyMjR8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "brightwire-work1": "https://images.unsplash.com/photo-1635335874521-7987db781153?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZWxlY3RyaWNhbCUyMHdpcmluZyUyMHdvcmt8ZW58MHwwfHx8MTc4NjM4ODI4M3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "brightwire-work2": "https://images.unsplash.com/photo-1718221621618-e477ce33485a?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bGlnaHQlMjBmaXh0dXJlJTIwaW5zdGFsbGF0aW9ufGVufDB8MHx8fDE3ODYzODgyODZ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "brightwire-work3": "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZWxlY3RyaWNhbCUyMG91dGxldCUyMGluc3RhbGxhdGlvbnxlbnwwfDB8fHwxNzg2Mzg4Mjg5fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "brightwire-diego": "https://images.unsplash.com/photo-1531750026848-8ada78f641c2?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bWFuJTIwcG9ydHJhaXQlMjBoZWFkc2hvdHxlbnwwfDB8fHwxNzg2Mzg4MzQ4fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
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
    url: src('brightwire-hero'),
    alt: 'A licensed electrician neatly wiring a home electrical panel',
  },
  {
    id: IMG.inspection,
    url: src('brightwire-inspection'),
    alt: 'An electrician checking outlets with a tester during a home safety inspection',
  },
  {
    id: IMG.marcus,
    url: src('brightwire-marcus'),
    alt: 'Marcus Hale, master electrician',
  },
  {
    id: IMG.diego,
    url: src('brightwire-diego'),
    alt: 'Diego Ramirez, panel and install specialist',
  },
  {
    id: IMG.ray,
    url: src('brightwire-ray'),
    alt: 'Ray Whitfield, service and safety electrician',
  },
  {
    id: IMG.work1,
    url: src('brightwire-work1'),
    alt: 'A tidy, labeled breaker panel after an upgrade',
  },
  {
    id: IMG.work2,
    url: src('brightwire-work2'),
    alt: 'Recessed lighting installed cleanly in a living-room ceiling',
  },
  {
    id: IMG.work3,
    url: src('brightwire-work3'),
    alt: 'A newly installed ceiling fan in a bright bedroom',
  },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-electrician-residential: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "brightwire": warm-white ground, charcoal primary, safety-yellow accent ─────
// The yellow is the ACCENT (a safety highlight), never primary text — primary stays a
// dependable charcoal so buttons read "done right, to code", and secondary is kept DARK so
// the uppercase micro-labels (`text-secondary`) pass contrast on the warm-white ground.
const brightwire = defineTheme({
  name: 'brightwire',
  type: { body: face('Inter', 'sans-serif'), head: face('Archivo', 'sans-serif') },
  shape: { selector: '0.25rem', field: '0.25rem', box: '0.375rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(98% 0.004 95)', // warm white
      'oklch(94% 0.006 95)', // pale sand
      'oklch(89% 0.008 95)', // hairline
      'oklch(24% 0.012 255)', // charcoal ink
    ],
    roles: {
      primary: 'oklch(32% 0.014 255)', // charcoal / graphite
      secondary: 'oklch(40% 0.02 255)', // dark slate
      accent: 'oklch(82% 0.155 88)', // safety yellow
      neutral: 'oklch(28% 0.012 255)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(22% 0.012 255)', // charcoal ground
      'oklch(18% 0.01 255)',
      'oklch(14% 0.008 255)',
      'oklch(95% 0.005 95)', // warm-white ink
    ],
    roles: {
      primary: 'oklch(90% 0.008 95)', // warm white — btn-primary reads on charcoal
      secondary: 'oklch(74% 0.016 255)', // light slate
      accent: 'oklch(84% 0.16 88)', // safety yellow
      neutral: 'oklch(82% 0.01 70)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the booking spine (policies, electricians + hours, the visit menu) ─────
const hours = (days: number[], startMinute: number, endMinute: number) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

const SCHEDULING = {
  policies: [
    {
      handle: 'standard-visit',
      name: 'Standard visit',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [1440, 120],
      policyText:
        'Please give us at least 24 hours’ notice to change or cancel a visit. We text a reminder the day before and two hours ahead, plus a heads-up when your electrician is on the way.',
    },
    {
      handle: 'emergency-callout',
      name: 'Emergency callout',
      depositType: 'none',
      cancellationWindowHours: 2,
      reminderOffsetsMin: [60],
      policyText:
        'Emergency callouts are booked as soon as an electrician is free — often same day. We confirm by phone before we head out so you always know who is coming and when.',
    },
  ],
  resources: [
    {
      handle: 'marcus',
      name: 'Marcus Hale',
      kind: 'staff',
      skillTags: ['repair', 'lighting', 'troubleshoot'],
      windows: hours([1, 2, 3, 4, 5], 480, 1020), // Mon–Fri 8–5
    },
    {
      handle: 'diego',
      name: 'Diego Ramirez',
      kind: 'staff',
      skillTags: ['panel', 'install', 'ev'],
      windows: hours([1, 2, 3, 4, 5], 420, 960), // Mon–Fri 7–4
    },
    {
      handle: 'ray',
      name: 'Ray Whitfield',
      kind: 'staff',
      skillTags: ['repair', 'safety', 'emergency'],
      windows: hours([1, 2, 3, 4, 5, 6], 480, 1080), // Mon–Sat 8–6
    },
  ],
  services: [
    {
      handle: 'free-estimate',
      name: 'Free in-home estimate',
      description:
        'We come out, look at the job, and give you a clear written price before any work starts. No charge, no pressure.',
      durationMinutes: 45,
      priceCents: 0,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'electrician', kind: 'staff', skillTags: ['repair'], count: 1 },
      ],
      policyHandle: 'standard-visit',
    },
    {
      handle: 'diagnostic-visit',
      name: 'Diagnostic visit',
      description:
        'Something not working right — a dead outlet, a tripping breaker, flickering lights? We find the cause and explain the fix in plain language. Fee credited toward the repair.',
      durationMinutes: 60,
      priceCents: 9900,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'electrician', kind: 'staff', skillTags: ['troubleshoot'], count: 1 },
      ],
      policyHandle: 'standard-visit',
    },
    {
      handle: 'outlet-lighting-install',
      name: 'Outlets & lighting install',
      description:
        'New outlets, USB receptacles, dimmers, under-cabinet or recessed lighting — installed cleanly and safely, tested before we leave.',
      durationMinutes: 120,
      priceCents: 18500,
      bufferAfterMin: 15,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'electrician', kind: 'staff', skillTags: ['lighting'], count: 1 },
      ],
      policyHandle: 'standard-visit',
    },
    {
      handle: 'ceiling-fan-install',
      name: 'Ceiling fan install',
      description:
        'Replacing an old fixture or wiring a fan where there wasn’t one — mounted solid, balanced, and wired to code.',
      durationMinutes: 90,
      priceCents: 14500,
      bufferAfterMin: 15,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'electrician', kind: 'staff', skillTags: ['install'], count: 1 },
      ],
      policyHandle: 'standard-visit',
    },
    {
      handle: 'panel-upgrade-consult',
      name: 'Panel upgrade consult',
      description:
        'Thinking about a service upgrade or a new breaker panel? We assess your current setup, talk through permits, and give you a fixed quote — free.',
      durationMinutes: 60,
      priceCents: 0,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'electrician', kind: 'staff', skillTags: ['panel'], count: 1 },
      ],
      policyHandle: 'standard-visit',
    },
    {
      handle: 'safety-inspection',
      name: 'Whole-home safety inspection',
      description:
        'A top-to-bottom check of your panel, outlets, grounding and smoke/CO coverage, with a clear written report of anything that needs attention. A flat fee.',
      durationMinutes: 120,
      priceCents: 14900,
      bufferAfterMin: 15,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'electrician', kind: 'staff', skillTags: ['safety'], count: 1 },
      ],
      policyHandle: 'standard-visit',
    },
    {
      handle: 'emergency-callout',
      name: 'Emergency callout',
      description:
        'No power, a burning smell, sparking or a scorched outlet — we prioritize it and confirm by phone before heading out. Booked to the next available electrician.',
      durationMinutes: 60,
      priceCents: 19900,
      requiresApproval: true,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'electrician', kind: 'staff', skillTags: ['emergency'], count: 1 },
      ],
      policyHandle: 'emergency-callout',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  photoHero({
    image: url(IMG.hero),
    alt: 'A licensed electrician neatly wiring a home electrical panel',
    title: 'Home electrical, done right and to code',
    sub: 'Licensed, insured, and tidy about it. Panel upgrades, outlets and lighting, ceiling fans, troubleshooting and whole-home safety — booked online in about a minute.',
    primary: { label: 'Book a free estimate', href: '/book' },
    secondary: { label: 'See our services', href: '/book' },
    overlay: 'darker',
  }),
  featureRow({
    items: [
      {
        title: 'Licensed & insured',
        body: 'Every job runs under a licensed electrician and full insurance — so the work is safe, warrantied and yours to trust.',
      },
      {
        title: 'Up-front pricing',
        body: 'You get a clear written price before we start. No surprise line items, no "while we were in there" add-ons.',
      },
      {
        title: 'Permits & code handled',
        body: 'When a job needs a permit or an inspection, we pull it and see it through. It’s done to code, on paper as well as in the wall.',
      },
      {
        title: 'Clean & tidy',
        body: 'We use drop cloths, wipe down, and haul off the old parts. You’d never know we were there — except that it finally works.',
      },
    ],
  }),
  serviceMenu({
    heading: 'What we do most',
    intro: 'A few of the visits homeowners book most often. Full details and live scheduling are on the booking page.',
    surface: 'muted',
    columns: 2,
    items: [
      {
        name: 'Free in-home estimate',
        priceCents: 0,
        durationMin: 45,
        desc: 'We look at the job and give you a written price — no charge.',
      },
      {
        name: 'Whole-home safety inspection',
        priceCents: 14900,
        durationMin: 120,
        desc: 'Panel, outlets, grounding and alarms, with a written report.',
      },
      {
        name: 'Outlets & lighting install',
        priceCents: 18500,
        durationMin: 120,
        desc: 'Outlets, dimmers and recessed or under-cabinet lighting.',
      },
      {
        name: 'Panel upgrade consult',
        priceCents: 0,
        durationMin: 60,
        desc: 'Service upgrades and new panels, with a fixed quote — free.',
      },
    ],
    cta: { label: 'See everything & book', href: '/book' },
  }),
  splitFeature({
    image: url(IMG.inspection),
    alt: 'An electrician checking outlets with a tester during a home safety inspection',
    heading: 'Safety first — every visit, every time',
    body: [
      'Before we touch a thing, we check what’s already there: the panel, the grounding, the outlets on the circuit we’re working. Old wiring and quiet problems are how small jobs turn into big ones, so we find them early.',
      'You get a straight answer about what’s safe, what can wait, and what shouldn’t — and a written note of anything we spot. No scare tactics, no upsell. Just the facts and a fair price.',
    ],
    cta: { label: 'Book a safety inspection', href: '/book' },
  }),
  teamRow({
    heading: 'The electricians who show up',
    intro: 'Real people, background-checked and in a marked truck. You’ll know exactly who’s coming to your door.',
    members: [
      {
        name: 'Marcus Hale',
        role: 'Master electrician',
        image: url(IMG.marcus),
        alt: 'Marcus Hale, master electrician',
        bio: 'Twenty years in residential work. Marcus leads the crew and handles the tricky troubleshooting calls.',
      },
      {
        name: 'Diego Ramirez',
        role: 'Panel & install specialist',
        image: url(IMG.diego),
        alt: 'Diego Ramirez, panel and install specialist',
        bio: 'Service upgrades, breaker panels and EV chargers — clean work, labeled and to code.',
      },
      {
        name: 'Ray Whitfield',
        role: 'Service & safety electrician',
        image: url(IMG.ray),
        alt: 'Ray Whitfield, service and safety electrician',
        bio: 'Inspections, repairs and emergency calls. Ray’s the one who’ll talk you through it on the phone.',
      },
    ],
  }),
  galleryStrip({
    heading: 'Recent work',
    surface: 'muted',
    columns: 3,
    images: [
      { src: url(IMG.work1), alt: 'A tidy, labeled breaker panel after an upgrade' },
      { src: url(IMG.work2), alt: 'Recessed lighting installed cleanly in a living-room ceiling' },
      { src: url(IMG.work3), alt: 'A newly installed ceiling fan in a bright bedroom' },
    ],
  }),
  testimonial({
    quote: 'They found the reason our breaker kept tripping in twenty minutes, fixed it, and showed me the old scorched wire so I understood. Left the closet cleaner than they found it. This is our electrician now.',
    attribution: 'Dana R., homeowner in Maple Grove',
  }),
  bookingCta({
    title: 'Get it looked at — free',
    sub: 'Pick a visit, choose a time that works, and we’ll be there. Estimates are always free and there’s never any pressure.',
    cta: { label: 'Book a free estimate', href: '/book' },
  }),
];

const BOOK_INTRO = [
  photoHero({
    image: url(IMG.hero),
    alt: 'A licensed electrician neatly wiring a home electrical panel',
    title: 'Book a visit',
    sub: 'Choose the kind of visit you need to see what’s involved and how long it takes, then pick your electrician and a time. Estimates and panel consults are free.',
    primary: { label: 'See visits below', href: '/book' },
    overlay: 'darker',
    align: 'start',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.work1),
    alt: 'A tidy, labeled breaker panel after an upgrade',
    heading: 'About Brightwire Electric',
    body: [
      'We started Brightwire because too many homeowners had been talked down to, overcharged, or left with work that wasn’t safe. We wanted to be the electrician you’d recommend to your own parents.',
      'That means licensed, insured work, a clear price before we start, and leaving your home cleaner than we found it. If it needs a permit, we pull it. If it can wait, we’ll tell you. Straight answers, every time.',
    ],
    cta: { label: 'Book a free estimate', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'How we work',
    items: [
      {
        title: 'We explain, not lecture',
        body: 'You’ll always know what’s wrong, what we’re doing about it, and why — in plain language, before we start.',
      },
      {
        title: 'Fixed prices, in writing',
        body: 'You approve a written price before any work begins. What we quote is what you pay.',
      },
      {
        title: 'Safe and to code',
        body: 'Grounding, GFCI/AFCI protection, permits and inspections — the parts you can’t see are the ones we care about most.',
      },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Call, or book online',
    address: ['Brightwire Electric', '412 Foundry Road', 'Unit C · Maple Grove, MN 55369'],
    mapLocation: '412 Foundry Road, Maple Grove, MN 55369',
    hours: [
      { day: 'Monday – Friday', time: '7:00 – 5:00' },
      { day: 'Saturday', time: '8:00 – 6:00' },
      { day: 'Sunday', time: 'Emergencies only' },
      { day: 'Emergency line', time: '24 / 7' },
    ],
  }),
  bookingCta({
    title: 'Rather book than call?',
    sub: 'See live availability and reserve your electrician online — no phone tag, no waiting on hold.',
    surface: 'muted',
    cta: { label: 'Book online', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-electrician-residential',
  name: 'Electrician (Residential)',
  summary:
    'A trustworthy residential-electrician site — a warm-white ground, a charcoal primary and a safety-yellow accent, with photo-led, code-to-safety copy. Installs a working booking flow: free estimates, diagnostics, outlet & lighting installs, panel consults, safety inspections and an emergency callout, with three electricians you book by name and their own weekly hours. Ships as "Brightwire Electric".',
  tagline: 'A warm, safety-first template for home electricians — book visits online from day one.',
  industry: 'Electrician',
  sortWeight: 74,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'Brightwire Electric', tagline: 'Home electrical, done right and to code.' },
  theme: brightwire,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Brightwire Electric — licensed residential electrician',
      description:
        'Brightwire Electric is a licensed, insured home electrician: panel upgrades, outlets and lighting, ceiling fans, troubleshooting and whole-home safety inspections. Book a free estimate online.',
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
