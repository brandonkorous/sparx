// sparx-law-family — "Hearth & Stone Law", a warm FAMILY & ESTATE law practice.
//
// The approachable, human end of the legal spectrum (the wills / trusts / probate /
// family-law lane): a soft cream-ivory ground, a deep-navy primary, a warm brass accent
// and a trustworthy serif display over a humanist sans. Deliberately the OPPOSITE of the
// modern business-litigation template (sharp, corporate, cool) — same booking spine, a
// different firm. The whole site turns on ONE action: booking a free consultation, with
// three attorneys you book by name.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-law-family.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-law-family/**" \
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
  hero: 'law-family-hero',
  office: 'law-family-office',
  eleanor: 'law-family-eleanor',
  marcus: 'law-family-marcus',
  priya: 'law-family-priya',
} as const;

// EMPTY on purpose — curated imagery is swapped in after generation. Until then every id
// resolves to a stable picsum seed via src().
const PHOTO: Record<string, string> = {
  "hearthstone-hero": "https://images.unsplash.com/photo-1775144657610-9a6f171e522f?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bGF3JTIwb2ZmaWNlJTIwd2FybXxlbnwwfDB8fHwxNzg2MzkwMDE1fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "hearthstone-office": "https://images.unsplash.com/photo-1758518731462-d091b0b4ed0d?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bGF3eWVyJTIwZGVzayUyMGRvY3VtZW50c3xlbnwwfDB8fHwxNzg2MzkwMDE4fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "hearthstone-eleanor": "https://images.unsplash.com/photo-1662104935883-e9dd0619eaba?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjBsYXd5ZXIlMjBwb3J0cmFpdHxlbnwwfDB8fHwxNzg2MzkwMDIxfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "hearthstone-marcus": "https://images.unsplash.com/photo-1734159350022-0acc5f934da5?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bGF3eWVyJTIwcG9ydHJhaXQlMjBtYW58ZW58MHwwfHx8MTc4NjM5MDAyNXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "hearthstone-priya": "https://images.unsplash.com/photo-1506863530036-1efeddceb993?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YXR0b3JuZXklMjBwb3J0cmFpdCUyMHdvbWFufGVufDB8MHx8fDE3ODYzOTAwMjh8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (seed: string): string =>
  PHOTO[seed] ?? `https://picsum.photos/seed/${seed}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}
const ASSETS: Asset[] = [
  { id: IMG.hero, url: src('hearthstone-hero'), alt: 'A warm law office with two people talking across a table' },
  { id: IMG.office, url: src('hearthstone-office'), alt: 'A calm, sunlit meeting room with comfortable chairs' },
  { id: IMG.eleanor, url: src('hearthstone-eleanor'), alt: 'Eleanor Stone, estate planning attorney' },
  { id: IMG.marcus, url: src('hearthstone-marcus'), alt: 'Marcus Hearth, family law attorney' },
  { id: IMG.priya, url: src('hearthstone-priya'), alt: 'Priya Nair, estate and business attorney' },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-law-family: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "hearthstone": cream ground, deep-navy primary, brass accent, warm serif ───
const hearthstone = defineTheme({
  name: 'hearthstone',
  type: { body: face('Inter', 'sans-serif'), head: face('Fraunces', 'serif') },
  shape: { selector: '0.25rem', field: '0.25rem', box: '0.375rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(97% 0.01 85)', // warm ivory ground
      'oklch(94% 0.014 82)', // parchment
      'oklch(89% 0.016 80)', // hairline
      'oklch(25% 0.02 255)', // deep navy-ink
    ],
    roles: {
      primary: 'oklch(40% 0.09 255)', // deep navy — trust, on the client's side
      secondary: 'oklch(38% 0.02 255)', // dark slate (readable micro-labels on the light ground)
      accent: 'oklch(68% 0.09 78)', // warm brass
      neutral: 'oklch(30% 0.015 255)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(22% 0.015 255)',
      'oklch(18% 0.012 255)',
      'oklch(14% 0.01 255)',
      'oklch(94% 0.01 85)',
    ],
    roles: {
      primary: 'oklch(70% 0.09 255)',
      secondary: 'oklch(75% 0.015 255)',
      accent: 'oklch(76% 0.09 78)',
      neutral: 'oklch(82% 0.012 255)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the booking spine (policies, attorneys + hours, the consult menu) ─────
const hours = (days: number[], startMinute: number, endMinute: number) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

const SCHEDULING = {
  policies: [
    {
      handle: 'consult-standard',
      name: 'Standard booking',
      depositType: 'none',
      cancellationWindowHours: 48,
      reminderOffsetsMin: [2880, 1440, 120],
      policyText:
        'Please give us at least 48 hours’ notice to change or cancel. We’ll send a reminder two days before, the day before, and two hours ahead so nothing slips.',
    },
    {
      handle: 'engagement-deposit',
      name: 'Engagement deposit',
      depositType: 'deposit',
      depositAmountCents: 25000,
      cancellationWindowHours: 48,
      reminderOffsetsMin: [2880, 1440, 120],
      policyText:
        'Longer working sessions hold a $250 deposit that comes off your final bill. Reschedule with 48 hours’ notice and it carries over to your new time.',
    },
  ],
  resources: [
    {
      handle: 'eleanor',
      name: 'Eleanor Stone',
      kind: 'staff',
      skillTags: ['consult', 'estate', 'wills', 'probate', 'trusts'],
      windows: hours([1, 2, 3, 4], 540, 1020), // Mon–Thu 9–5
    },
    {
      handle: 'marcus',
      name: 'Marcus Hearth',
      kind: 'staff',
      skillTags: ['consult', 'family', 'divorce', 'custody', 'guardianship'],
      windows: hours([1, 2, 3, 4, 5], 570, 1050), // Mon–Fri 9:30–5:30
    },
    {
      handle: 'priya',
      name: 'Priya Nair',
      kind: 'staff',
      skillTags: ['consult', 'estate', 'business', 'trusts'],
      windows: hours([2, 3, 4, 5], 600, 1080), // Tue–Fri 10–6
    },
  ],
  services: [
    {
      handle: 'free-consultation',
      name: 'Free consultation',
      description:
        'A relaxed, no-pressure first conversation. Tell us what’s on your mind and we’ll explain your options in plain English — no bill, no commitment.',
      durationMinutes: 30,
      priceCents: 0,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'attorney', kind: 'staff', skillTags: ['consult'], count: 1 }],
      policyHandle: 'consult-standard',
    },
    {
      handle: 'estate-planning-consult',
      name: 'Estate planning consultation',
      description:
        'Sit down with us about wills, trusts and a plan for the people you love. We’ll walk you through what you actually need — and what you don’t.',
      durationMinutes: 60,
      priceCents: 0,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'attorney', kind: 'staff', skillTags: ['estate'], count: 1 }],
      policyHandle: 'consult-standard',
    },
    {
      handle: 'will-trust-review',
      name: 'Will & trust review',
      description:
        'Already have documents? We’ll read them closely and tell you honestly whether they still do what you want — a flat fee, no surprises.',
      durationMinutes: 45,
      priceCents: 15000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'attorney', kind: 'staff', skillTags: ['wills'], count: 1 }],
      policyHandle: 'consult-standard',
    },
    {
      handle: 'probate-consult',
      name: 'Probate consultation',
      description:
        'Lost someone and unsure what happens next? We’ll explain the probate process gently, step by step, and what we can take off your plate.',
      durationMinutes: 45,
      priceCents: 0,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'attorney', kind: 'staff', skillTags: ['probate'], count: 1 }],
      policyHandle: 'consult-standard',
    },
    {
      handle: 'family-law-consult',
      name: 'Family law consultation',
      description:
        'Divorce, custody and support, handled with care and without the drama. A calm first meeting to understand where you stand and what’s ahead.',
      durationMinutes: 45,
      priceCents: 0,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'attorney', kind: 'staff', skillTags: ['family'], count: 1 }],
      policyHandle: 'consult-standard',
    },
    {
      handle: 'business-formation-consult',
      name: 'Business formation session',
      description:
        'Starting or restructuring a family business? A working session to set it up right — the entity, the paperwork and how it fits your estate plan.',
      durationMinutes: 60,
      priceCents: 25000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'attorney', kind: 'staff', skillTags: ['business'], count: 1 }],
      policyHandle: 'engagement-deposit',
    },
    {
      handle: 'guardianship-consult',
      name: 'Guardianship consultation',
      description:
        'When someone you love needs protecting — a child or an aging parent — we’ll explain guardianship and conservatorship in words that make sense.',
      durationMinutes: 45,
      priceCents: 0,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'attorney', kind: 'staff', skillTags: ['guardianship'], count: 1 },
      ],
      policyHandle: 'consult-standard',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  photoHero({
    image: url(IMG.hero),
    alt: 'A warm law office with two people talking across a table',
    title: 'The law, on your side, explained plainly',
    sub: 'Wills, trusts, probate and family matters — handled by people who take the time to make it make sense. Start with a free, no-pressure conversation.',
    primary: { label: 'Book a free consultation', href: '/book' },
    secondary: { label: 'See how we help', href: '/book' },
    overlay: 'darker',
  }),
  featureRow({
    items: [
      {
        title: 'Plain English, always',
        body: 'No jargon, no talking down to you. We explain what things mean and what your choices are, so you can decide with confidence.',
      },
      {
        title: 'Fees you can see coming',
        body: 'Many matters are flat-fee, and your first consultation is free. You’ll always know what something costs before we begin.',
      },
      {
        title: 'We can come to you',
        body: 'Meet in the office, by phone or video, or at home if getting out is hard. We work around your life, not the other way around.',
      },
    ],
  }),
  serviceMenu({
    heading: 'How we can help',
    intro: 'A few of the ways families work with us. Every consultation starts free — you only decide to go further once you understand your options.',
    surface: 'muted',
    columns: 2,
    items: [
      { name: 'Free consultation', priceCents: 0, durationMin: 30, desc: 'A no-pressure first conversation about what you need.' },
      { name: 'Estate planning', priceCents: 0, durationMin: 60, desc: 'Wills, trusts and a plan for the people you love.' },
      { name: 'Family law', priceCents: 0, durationMin: 45, desc: 'Divorce, custody and support, handled with care.' },
      { name: 'Will & trust review', priceCents: 15000, durationMin: 45, desc: 'A close, honest read of documents you already have.' },
    ],
    cta: { label: 'See everything & book', href: '/book' },
  }),
  splitFeature({
    image: url(IMG.office),
    alt: 'A calm, sunlit meeting room with comfortable chairs',
    heading: 'A practice that treats you like a person',
    body: [
      'Hearth & Stone Law has helped families in this community plan, protect and move forward for more than twenty years. Most of our clients come from someone we’ve already helped — a neighbor, a parent, a friend.',
      'We take on fewer matters so we can give yours real attention. You’ll never feel like a case number, and you’ll always be able to reach the person handling your work.',
    ],
    cta: { label: 'Book your consultation', href: '/book' },
  }),
  teamRow({
    heading: 'The people you’ll work with',
    intro: 'Book by name — you’ll meet with the same attorney each time.',
    members: [
      { name: 'Eleanor Stone', role: 'Estate planning attorney', image: url(IMG.eleanor), alt: 'Eleanor Stone, estate planning attorney', bio: 'Wills, trusts and probate. Eleanor is known for making a hard subject feel calm and clear.' },
      { name: 'Marcus Hearth', role: 'Family law attorney', image: url(IMG.marcus), alt: 'Marcus Hearth, family law attorney', bio: 'Divorce, custody and guardianship, guided with patience and a steady hand.' },
      { name: 'Priya Nair', role: 'Estate & business attorney', image: url(IMG.priya), alt: 'Priya Nair, estate and business attorney', bio: 'Trusts and family businesses — protecting what you’ve built for the next generation.' },
    ],
  }),
  testimonial({
    quote: 'They walked my mother and me through probate after my father passed, one gentle step at a time. They made an impossibly hard season a little easier.',
    attribution: 'Diane R., client since 2022',
  }),
  bookingCta({
    title: 'Let’s start with a conversation',
    sub: 'Your first consultation is free and there’s no obligation. Pick an attorney, choose a time that works, and we’ll take it from there.',
    cta: { label: 'Book a free consultation', href: '/book' },
  }),
];

const BOOK_INTRO = [
  photoHero({
    image: url(IMG.office),
    alt: 'A calm, sunlit meeting room with comfortable chairs',
    title: 'Book your consultation',
    sub: 'Choose what you’d like to talk about to see who can help and when, then pick your attorney and a time. Your first consultation is free.',
    primary: { label: 'See consultations below', href: '/book' },
    overlay: 'darker',
    align: 'start',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.hero),
    alt: 'A warm law office with two people talking across a table',
    heading: 'About Hearth & Stone Law',
    body: [
      'We started Hearth & Stone Law on a simple belief: that legal help for families should feel human. The moments that bring people to us — planning for children, losing a parent, protecting someone who can’t protect themselves — are tender ones, and they deserve care, not a cold desk.',
      'So we do things a little differently. We explain everything in plain words, we quote fees up front, and we stay reachable long after the paperwork is signed. Twenty years on, most of our clients still come from someone we’ve helped before.',
    ],
    cta: { label: 'Book a free consultation', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'How we work',
    items: [
      { title: 'We listen first', body: 'Every matter starts with your story — what you’re worried about, who you’re protecting, and what a good outcome looks like to you.' },
      { title: 'We keep it clear', body: 'You’ll get straight answers in plain English, a written summary of your options, and honest advice on what’s worth doing.' },
      { title: 'We stay with you', body: 'We don’t disappear when the documents are signed. As life changes, we’re here to update your plan and answer the next question.' },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Come see us',
    address: ['Hearth & Stone Law', '214 Maple Court', 'Suite 5 · Burlington, VT 05401'],
    mapLocation: '214 Maple Court, Burlington, VT 05401',
    hours: [
      { day: 'Monday – Thursday', time: '9:00 – 5:30' },
      { day: 'Friday', time: '9:30 – 5:00' },
      { day: 'Saturday', time: 'By appointment' },
      { day: 'Sunday', time: 'Closed' },
    ],
  }),
  bookingCta({
    title: 'Rather book than call?',
    sub: 'See who’s available and reserve your free consultation online — no phone tag, no waiting on hold.',
    surface: 'muted',
    cta: { label: 'Book a free consultation', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-law-family',
  name: 'Law (Family & Estate)',
  summary:
    'A warm, approachable family and estate law site — a cream ground, a deep-navy primary and a trustworthy serif — built around booking a free consultation. Installs a working booking flow: wills, trusts, probate, family-law and guardianship consults, three attorneys you book by name with their own hours, and a standard reschedule policy. Ships as "Hearth & Stone Law", a caring, plain-English practice.',
  tagline: 'A warm, human template for family & estate law firms — book consultations from day one.',
  industry: 'Law firm',
  sortWeight: 66,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'Hearth & Stone Law', tagline: 'The law, on your side, explained plainly.' },
  theme: hearthstone,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Hearth & Stone Law — family & estate attorneys',
      description:
        'Hearth & Stone Law is a warm, plain-English practice for wills, trusts, probate and family law. Book a free consultation with an attorney online.',
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
