// sparx-accounting-smallbiz — "Ledger & Co.", a friendly small-business bookkeeping & tax practice.
//
// The warm, approachable everyday accountant — the one that takes the numbers off your
// plate so you can run your business. A fresh teal primary, a warm coral accent, a clean
// warm-white ground and a dark-slate secondary for readable micro-labels; a friendly clean
// sans (Outfit) over Inter, rounded-ish edges. Deliberately the OPPOSITE of the premium CPA
// advisory/wealth template (refined, restrained) — same booking spine, a different, warmer
// business: freelancers and small businesses, plain English, no jargon, nothing scary.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-accounting-smallbiz.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-accounting-smallbiz/**" \
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
  hero: 'accounting-smallbiz-hero',
  desk: 'accounting-smallbiz-desk',
  dana: 'accounting-smallbiz-dana',
  marcus: 'accounting-smallbiz-marcus',
  rosa: 'accounting-smallbiz-rosa',
} as const;

const PHOTO: Record<string, string> = {
  "ledgerco-hero": "https://images.unsplash.com/photo-1713947503588-8ff8196dc4a3?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YWNjb3VudGFudCUyMHdvcmtpbmclMjBkZXNrfGVufDB8MHx8fDE3ODYzOTAwNDZ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "ledgerco-desk": "https://images.unsplash.com/photo-1707157284454-553ef0a4ed0d?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Ym9va2tlZXBpbmclMjBjYWxjdWxhdG9yJTIwZGVza3xlbnwwfDB8fHwxNzg2MzkwMDQ5fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "ledgerco-dana": "https://images.unsplash.com/photo-1484863137850-59afcfe05386?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjBhY2NvdW50YW50JTIwcG9ydHJhaXR8ZW58MHwwfHx8MTc4NjM5MDA1Mnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "ledgerco-marcus": "https://images.unsplash.com/photo-1676989880361-091e12efc056?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YWNjb3VudGFudCUyMHBvcnRyYWl0JTIwbWFufGVufDB8MHx8fDE3ODYzOTAwNTV8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "ledgerco-rosa": "https://images.unsplash.com/photo-1630939687530-241d630735df?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YnVzaW5lc3N3b21hbiUyMHBvcnRyYWl0JTIwc21pbGluZ3xlbnwwfDB8fHwxNzg2MzkwMDU4fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
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
    url: src('ledgerco-hero'),
    alt: 'A friendly, sunlit workspace with a laptop, a coffee and a small stack of paperwork',
  },
  {
    id: IMG.desk,
    url: src('ledgerco-desk'),
    alt: 'A tidy desk with a calculator, notebook and a cup of coffee',
  },
  { id: IMG.dana, url: src('ledgerco-dana'), alt: 'Dana Whitfield, tax and small-business lead' },
  { id: IMG.marcus, url: src('ledgerco-marcus'), alt: 'Marcus Bell, bookkeeping and payroll' },
  { id: IMG.rosa, url: src('ledgerco-rosa'), alt: 'Rosa Nguyen, new-business setup and advisory' },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-accounting-smallbiz: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "ledgerco": warm-white ground, fresh teal primary, warm coral accent ──────
const ledgerco = defineTheme({
  name: 'ledgerco',
  type: { body: face('Inter', 'sans-serif'), head: face('Outfit', 'sans-serif') },
  shape: { selector: '0.625rem', field: '0.625rem', box: '0.875rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(98% 0.006 95)', // warm white
      'oklch(95% 0.01 130)', // pale sage
      'oklch(90% 0.014 150)', // hairline
      'oklch(27% 0.02 200)', // dark slate ink
    ],
    roles: {
      primary: 'oklch(58% 0.11 185)', // fresh teal
      secondary: 'oklch(34% 0.025 210)', // dark slate (readable micro-labels on light)
      accent: 'oklch(70% 0.14 45)', // warm coral
      neutral: 'oklch(30% 0.02 210)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(24% 0.02 210)',
      'oklch(20% 0.018 210)',
      'oklch(16% 0.015 210)',
      'oklch(95% 0.008 130)',
    ],
    roles: {
      primary: 'oklch(70% 0.11 185)',
      secondary: 'oklch(80% 0.02 150)',
      accent: 'oklch(76% 0.13 45)',
      neutral: 'oklch(82% 0.015 150)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the booking spine (policies, accountants + hours, consult menu) ──────
const hours = (days: number[], startMinute: number, endMinute: number) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

const SCHEDULING = {
  policies: [
    {
      handle: 'standard',
      name: 'Standard booking',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [1440, 120],
      policyText:
        'Need to move your appointment? Just give us 24 hours’ notice. We’ll send a reminder the day before and again two hours ahead, so nothing sneaks up on you.',
    },
  ],
  resources: [
    {
      handle: 'dana',
      name: 'Dana Whitfield',
      kind: 'staff',
      skillTags: ['tax', 'smallbiz', 'setup'],
      windows: hours([1, 2, 3, 4, 5], 540, 1020), // Mon–Fri 9–5
    },
    {
      handle: 'marcus',
      name: 'Marcus Bell',
      kind: 'staff',
      skillTags: ['bookkeeping', 'payroll', 'advisory'],
      windows: hours([1, 2, 3, 4], 540, 1080), // Mon–Thu 9–6
    },
    {
      handle: 'rosa',
      name: 'Rosa Nguyen',
      kind: 'staff',
      skillTags: ['tax', 'bookkeeping', 'payroll'],
      windows: hours([2, 3, 4, 5], 600, 1080), // Tue–Fri 10–6
    },
  ],
  services: [
    {
      handle: 'free-consultation',
      name: 'Free consultation',
      description:
        'A relaxed 30-minute call to talk through where your books are, what’s stressing you out, and how we can help. No cost, no pressure.',
      durationMinutes: 30,
      priceCents: 0,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'accountant', kind: 'staff', skillTags: ['tax'], count: 1 },
      ],
      policyHandle: 'standard',
    },
    {
      handle: 'tax-prep-consult',
      name: 'Tax prep consultation',
      description:
        'Sit down with us before tax season so nothing gets missed. We’ll map out what you owe, what you can deduct, and how to keep more of what you earn.',
      durationMinutes: 45,
      priceCents: 12500,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'accountant', kind: 'staff', skillTags: ['tax'], count: 1 },
      ],
      policyHandle: 'standard',
    },
    {
      handle: 'bookkeeping-setup',
      name: 'Bookkeeping setup',
      description:
        'We’ll get your books set up right from the start — connected accounts, clean categories, and a simple monthly rhythm you can actually keep up with.',
      durationMinutes: 60,
      priceCents: 20000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'accountant', kind: 'staff', skillTags: ['bookkeeping'], count: 1 },
      ],
      policyHandle: 'standard',
    },
    {
      handle: 'payroll-setup',
      name: 'Payroll setup',
      description:
        'Hiring your first employee, or just tired of doing payroll by hand? We’ll set it up so everyone gets paid on time and the taxes are handled for you.',
      durationMinutes: 60,
      priceCents: 18000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'accountant', kind: 'staff', skillTags: ['payroll'], count: 1 },
      ],
      policyHandle: 'standard',
    },
    {
      handle: 'quarterly-tax-review',
      name: 'Quarterly tax review',
      description:
        'A quick check-in each quarter so your estimated taxes are on track and there are no surprises in April. Peace of mind, four times a year.',
      durationMinutes: 45,
      priceCents: 15000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'accountant', kind: 'staff', skillTags: ['tax'], count: 1 },
      ],
      policyHandle: 'standard',
    },
    {
      handle: 'new-business-setup',
      name: 'New business setup',
      description:
        'Starting something new? We’ll help you pick the right structure (LLC, S-corp and the rest), register it properly, and start on the right foot.',
      durationMinutes: 60,
      priceCents: 25000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'accountant', kind: 'staff', skillTags: ['setup'], count: 1 },
      ],
      policyHandle: 'standard',
    },
    {
      handle: 'small-business-advisory',
      name: 'Small business advisory',
      description:
        'A sit-down to look at the bigger picture — cash flow, pricing, what the numbers are telling you, and the next smart move for your business.',
      durationMinutes: 60,
      priceCents: 22000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'accountant', kind: 'staff', skillTags: ['advisory'], count: 1 },
      ],
      policyHandle: 'standard',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  photoHero({
    image: url(IMG.hero),
    alt: 'A friendly, sunlit workspace with a laptop, a coffee and a small stack of paperwork',
    title: 'The numbers, off your plate',
    sub: 'Friendly bookkeeping, payroll and taxes for freelancers and small businesses — so you can get back to running the thing you actually love.',
    primary: { label: 'Book a free consult', href: '/book' },
    secondary: { label: 'See what we do', href: '/book' },
    overlay: 'dark',
  }),
  featureRow({
    items: [
      {
        title: 'One flat monthly price',
        body: 'No surprise invoices, no hourly meter running. You’ll know exactly what you pay every month — and it won’t change because you asked a question.',
      },
      {
        title: 'We speak plain English',
        body: 'No jargon, no lecture. We explain your numbers the way we’d explain them to a friend — clearly, honestly, and without making you feel behind.',
      },
      {
        title: 'Deadlines we never miss',
        body: 'Quarterly taxes, payroll filings, year-end — we track every date so you don’t have to. No late fees, no last-minute scramble, ever.',
      },
    ],
  }),
  serviceMenu({
    heading: 'How we help',
    intro: 'Pick a service to see how long it takes and what it costs. Not sure where to start? Book the free consult — that’s what it’s for.',
    surface: 'muted',
    columns: 2,
    items: [
      {
        name: 'Free consultation',
        priceCents: 0,
        durationMin: 30,
        desc: 'A no-pressure chat about where your books are and how we can help.',
      },
      {
        name: 'Bookkeeping setup',
        priceCents: 20000,
        durationMin: 60,
        desc: 'Clean books from day one, with a monthly rhythm you can keep.',
      },
      {
        name: 'Tax prep consultation',
        priceCents: 12500,
        durationMin: 45,
        desc: 'Get ahead of tax season and keep more of what you earn.',
      },
      {
        name: 'New business setup',
        priceCents: 25000,
        durationMin: 60,
        desc: 'The right structure, registered properly, from the start.',
      },
    ],
    cta: { label: 'See everything & book', href: '/book' },
  }),
  splitFeature({
    image: url(IMG.desk),
    alt: 'A tidy desk with a calculator, notebook and a cup of coffee',
    heading: 'You run the business. We’ll run the books.',
    body: [
      'Most small-business owners didn’t start out to become part-time accountants — but somehow the spreadsheets, the receipts and the quarterly taxes landed on their desk anyway.',
      'That’s where we come in. We take all of it off your plate, keep it tidy and up to date, and tell you in plain language exactly where you stand. No stress, no jargon, no April panic.',
    ],
    cta: { label: 'Book a free consult', href: '/book' },
  }),
  teamRow({
    heading: 'The people behind your books',
    intro: 'A small, friendly team that actually gets to know your business. Book with whoever fits — we’ll point you to the right person.',
    members: [
      {
        name: 'Dana Whitfield',
        role: 'Tax & small business',
        image: url(IMG.dana),
        alt: 'Dana Whitfield, tax and small-business lead',
        bio: 'Fifteen years of small-business taxes, and a knack for making them feel simple.',
      },
      {
        name: 'Marcus Bell',
        role: 'Bookkeeping & payroll',
        image: url(IMG.marcus),
        alt: 'Marcus Bell, bookkeeping and payroll',
        bio: 'Keeps your books clean and your team paid — on time, every time.',
      },
      {
        name: 'Rosa Nguyen',
        role: 'Setup & advisory',
        image: url(IMG.rosa),
        alt: 'Rosa Nguyen, new-business setup and advisory',
        bio: 'Helps new owners start right and growing ones make the next smart move.',
      },
    ],
  }),
  testimonial({
    quote:
      'I used to dread every tax season and lose whole weekends to my books. Now I honestly don’t think about it — they just handle it, and I finally feel on top of my money.',
    attribution: 'Priya, bakery owner & client since 2022',
  }),
  bookingCta({
    title: 'Let’s take a look at your books',
    sub: 'Book a free 30-minute consult. We’ll talk through where you are and how we can help — no cost, no commitment.',
    cta: { label: 'Book a free consult', href: '/book' },
  }),
];

const BOOK_INTRO = [
  photoHero({
    image: url(IMG.desk),
    alt: 'A tidy desk with a calculator, notebook and a cup of coffee',
    title: 'Book your consultation',
    sub: 'Choose a service below to see what it costs and how long it takes, then pick your accountant and a time that works for you.',
    primary: { label: 'See services below', href: '/book' },
    overlay: 'darker',
    align: 'start',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.hero),
    alt: 'A friendly, sunlit workspace with a laptop, a coffee and a small stack of paperwork',
    heading: 'About Ledger & Co.',
    body: [
      'We started Ledger & Co. because we kept meeting small-business owners who were brilliant at their craft and completely underwater on their books — not because they weren’t smart, but because nobody ever made the money side feel human.',
      'So that’s what we do. We handle the bookkeeping, payroll and taxes, and we explain it all in plain English. You get your evenings back, your numbers make sense, and tax season stops being something to fear.',
    ],
    cta: { label: 'Book a free consult', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'How we work',
    items: [
      {
        title: 'A real person, every time',
        body: 'You’ll work with the same friendly team who knows your business — not a call center and never a different stranger each month.',
      },
      {
        title: 'Everything in the cloud',
        body: 'Your books live online, always current, always accessible. Check in whenever you like, or leave it to us — either way it’s handled.',
      },
      {
        title: 'Honest, upfront pricing',
        body: 'Flat monthly plans, spelled out before you commit. Ask us anything without watching a clock — questions are part of the service.',
      },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Come say hello',
    address: ['Ledger & Co.', '412 Maple Avenue', 'Suite 5 · Asheville, NC 28801'],
    mapLocation: '412 Maple Avenue, Asheville, NC 28801',
    hours: [
      { day: 'Monday – Thursday', time: '9:00 – 6:00' },
      { day: 'Friday', time: '9:00 – 5:00' },
      { day: 'Saturday', time: 'By appointment' },
      { day: 'Sunday', time: 'Closed' },
    ],
  }),
  bookingCta({
    title: 'Rather just book a time?',
    sub: 'Grab a free consult online and pick a slot that suits you — no phone tag, no waiting on a callback.',
    surface: 'muted',
    cta: { label: 'Book a free consult', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-accounting-smallbiz',
  name: 'sparx — Accounting (Small Business)',
  summary:
    'A warm, friendly small-business accounting site — a fresh teal palette, a coral accent and a clean, approachable look. Installs a working booking flow: three accountants you book by name, and a real menu of consultations (a free consult, bookkeeping, payroll, quarterly taxes, new-business setup). Ships as "Ledger & Co.", the everyday bookkeeping & tax practice for freelancers and small businesses.',
  tagline: 'A friendly template for bookkeeping & tax practices — take bookings from day one.',
  industry: 'Accounting',
  sortWeight: 64,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'Ledger & Co.', tagline: 'The numbers, off your plate.' },
  theme: ledgerco,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Ledger & Co. — friendly bookkeeping & taxes for small business',
      description:
        'Ledger & Co. handles the bookkeeping, payroll and taxes for freelancers and small businesses — in plain English, at one flat monthly price. Book a free consult online.',
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
