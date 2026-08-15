// sparx-law-modern — "Meridian Law Group", a modern BUSINESS & LITIGATION firm.
//
// The sharp, corporate practice: a deep midnight-slate primary over a crisp near-white
// ground, a confident blue accent, and a precise modern sans (Space Grotesk over Inter).
// Confident, results-driven, big-firm polish at a boutique. Deliberately the OPPOSITE of
// the warm family/estate law template (serif, cream, unhurried) — same booking spine, a
// different firm: here the functional core is booking a CONSULTATION, and the page leads
// with attitude and track record rather than warmth.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-law-modern.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-law-modern/**" \
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
  typeHero,
  type ServiceSiteSpec,
} from './service-sites/harness';

// ── Imagery (swap-ready; each id also names an entry in ASSETS) ────────────────────
const IMG = {
  office: 'law-modern-office',
  boardroom: 'law-modern-boardroom',
  marcus: 'law-modern-marcus',
  elena: 'law-modern-elena',
  david: 'law-modern-david',
} as const;

// EMPTY on purpose — every image resolves through the picsum fallback in `src()`, keyed by
// a unique `meridianlaw-` seed. Drop real URLs in here later to art-direct without touching
// the tree.
const PHOTO: Record<string, string> = {
  "meridianlaw-office": "https://images.unsplash.com/photo-1778800053717-9c0ad9b8751d?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bW9kZXJuJTIwbGF3JTIwb2ZmaWNlfGVufDB8MHx8fDE3ODYzOTAwMzF8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "meridianlaw-boardroom": "https://images.unsplash.com/photo-1431540015161-0bf868a2d407?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8b2ZmaWNlJTIwYm9hcmRyb29tJTIwbWVldGluZ3xlbnwwfDB8fHwxNzg2MzkwMDM1fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "meridianlaw-marcus": "https://images.unsplash.com/photo-1507679799987-c73779587ccf?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YnVzaW5lc3NtYW4lMjBwb3J0cmFpdCUyMHN1aXR8ZW58MHwwfHx8MTc4NjM5MDAzN3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "meridianlaw-elena": "https://images.unsplash.com/photo-1637589267610-6c66fc2a086b?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YnVzaW5lc3N3b21hbiUyMHBvcnRyYWl0fGVufDB8MHx8fDE3ODYzOTAwNDB8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "meridianlaw-david": "https://images.unsplash.com/photo-1734159350022-0acc5f934da5?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bGF3eWVyJTIwcG9ydHJhaXQlMjBtYW4lMjBzdWl0fGVufDB8MHx8fDE3ODYzOTAwNDN8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
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
    id: IMG.office,
    url: src('meridianlaw-office'),
    alt: 'A modern downtown law office with floor-to-ceiling windows at dusk',
  },
  {
    id: IMG.boardroom,
    url: src('meridianlaw-boardroom'),
    alt: 'A sharp glass-walled boardroom set for a strategy session',
  },
  {
    id: IMG.marcus,
    url: src('meridianlaw-marcus'),
    alt: 'Marcus Reid, managing partner, corporate & M&A',
  },
  {
    id: IMG.elena,
    url: src('meridianlaw-elena'),
    alt: 'Elena Vasquez, partner, commercial litigation & employment',
  },
  {
    id: IMG.david,
    url: src('meridianlaw-david'),
    alt: 'David Chen, partner, intellectual property & contracts',
  },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-law-modern: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "meridian": crisp near-white ground, midnight-slate primary, blue accent ────
const meridian = defineTheme({
  name: 'meridian',
  type: { body: face('Inter', 'sans-serif'), head: face('Space Grotesk', 'sans-serif') },
  shape: { selector: '0.25rem', field: '0.25rem', box: '0.375rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(98% 0.004 255)', // crisp near-white, faint cool cast
      'oklch(95% 0.006 255)', // pale slate
      'oklch(89% 0.01 255)', // hairline
      'oklch(24% 0.02 258)', // midnight-slate ink
    ],
    roles: {
      primary: 'oklch(34% 0.06 258)', // deep midnight slate/navy
      secondary: 'oklch(40% 0.025 255)', // dark slate — micro-labels stay legible on light
      accent: 'oklch(55% 0.15 245)', // confident blue
      neutral: 'oklch(28% 0.02 258)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(20% 0.02 258)', // charcoal slate
      'oklch(16% 0.018 258)',
      'oklch(13% 0.015 258)',
      'oklch(95% 0.005 255)', // near-white ink
    ],
    roles: {
      primary: 'oklch(70% 0.11 250)', // luminous navy-blue on dark
      secondary: 'oklch(74% 0.02 255)',
      accent: 'oklch(70% 0.14 245)',
      neutral: 'oklch(82% 0.015 255)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the booking spine (policies, attorneys + hours, the consult menu) ──────
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
        'Please give us at least 48 hours’ notice to reschedule or cancel a consultation. We send reminders two days and one day ahead, and again two hours before.',
    },
    {
      handle: 'consult-deposit',
      name: 'Consultation with deposit',
      depositType: 'deposit',
      depositAmountCents: 15000,
      cancellationWindowHours: 48,
      reminderOffsetsMin: [2880, 1440, 120],
      policyText:
        'Paid strategy consultations hold a $150 deposit that is credited in full toward your first invoice if you engage the firm. Reschedule with 48 hours’ notice and the deposit carries over.',
    },
  ],
  resources: [
    {
      handle: 'marcus-reid',
      name: 'Marcus Reid',
      kind: 'staff',
      skillTags: ['corporate', 'ma', 'contracts', 'formation'],
      windows: hours([1, 2, 3, 4, 5], 510, 1080), // Mon–Fri 8:30–6
    },
    {
      handle: 'elena-vasquez',
      name: 'Elena Vasquez',
      kind: 'staff',
      skillTags: ['litigation', 'disputes', 'employment', 'contracts'],
      windows: hours([1, 2, 3, 4, 5], 540, 1110), // Mon–Fri 9–6:30
    },
    {
      handle: 'david-chen',
      name: 'David Chen',
      kind: 'staff',
      skillTags: ['ip', 'contracts', 'corporate'],
      windows: hours([1, 2, 3, 4], 540, 1020), // Mon–Thu 9–5
    },
  ],
  services: [
    {
      handle: 'initial-consultation',
      name: 'Initial consultation',
      description:
        'A complimentary 30-minute call to understand your matter, map the options and tell you plainly whether and how we can help.',
      durationMinutes: 30,
      priceCents: 0,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'attorney', kind: 'staff', skillTags: ['corporate'], count: 1 },
      ],
      policyHandle: 'consult-standard',
    },
    {
      handle: 'business-formation-consult',
      name: 'Business formation consultation',
      description:
        'Entity choice, founder and operating agreements, equity and the clean setup that avoids expensive fixes later.',
      durationMinutes: 45,
      priceCents: 25000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'attorney', kind: 'staff', skillTags: ['formation'], count: 1 },
      ],
      policyHandle: 'consult-deposit',
    },
    {
      handle: 'contract-review-consult',
      name: 'Contract review consultation',
      description:
        'A working session on a specific agreement — where the risk sits, what to push back on and what to sign.',
      durationMinutes: 45,
      priceCents: 25000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'attorney', kind: 'staff', skillTags: ['contracts'], count: 1 },
      ],
      policyHandle: 'consult-deposit',
    },
    {
      handle: 'litigation-consult',
      name: 'Commercial litigation consultation',
      description:
        'A candid read on a dispute or threatened claim — exposure, leverage, the realistic paths and what each one costs.',
      durationMinutes: 60,
      priceCents: 35000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'attorney', kind: 'staff', skillTags: ['litigation'], count: 1 },
      ],
      policyHandle: 'consult-deposit',
    },
    {
      handle: 'employment-consult',
      name: 'Employment matter consultation',
      description:
        'Hiring, separations, restrictive covenants, policies and the claims that follow when they’re handled badly.',
      durationMinutes: 45,
      priceCents: 25000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'attorney', kind: 'staff', skillTags: ['employment'], count: 1 },
      ],
      policyHandle: 'consult-deposit',
    },
    {
      handle: 'ip-consult',
      name: 'Intellectual property consultation',
      description:
        'Trademarks, trade secrets, licensing and IP assignment — protecting what your business is actually built on.',
      durationMinutes: 45,
      priceCents: 25000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'attorney', kind: 'staff', skillTags: ['ip'], count: 1 }],
      policyHandle: 'consult-deposit',
    },
    {
      handle: 'ma-advisory-consult',
      name: 'M&A advisory consultation',
      description:
        'A strategy session for a purchase, sale or investment — deal structure, diligence and the terms worth holding the line on.',
      durationMinutes: 60,
      priceCents: 35000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'attorney', kind: 'staff', skillTags: ['ma'], count: 1 }],
      policyHandle: 'consult-deposit',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  typeHero({
    surface: 'primary',
    title: 'Sharp counsel for the moments that decide the business',
    sub: 'Meridian Law Group handles the corporate deals, commercial disputes and employment questions that carry real consequences — with senior attorneys, plain answers and a plan you can act on.',
    primary: { label: 'Schedule a consultation', href: '/book' },
    secondary: { label: 'See how we work', href: '/book' },
  }),
  featureRow({
    items: [
      {
        title: 'Senior attorneys on every matter',
        body: 'A partner runs your work — not a rotating cast of juniors learning on your bill. You get judgment, not just hours.',
      },
      {
        title: 'Scoped and priced up front',
        body: 'You’ll know the plan, the fee and the likely outcomes before we start. No surprise invoices, no meter anxiety.',
      },
      {
        title: 'Responsive when it counts',
        body: 'Deals and disputes move fast. We answer fast — same-day on live matters, because a delayed answer is often the wrong one.',
      },
    ],
  }),
  serviceMenu({
    heading: 'Consultations',
    intro: 'Start with a conversation. The initial consultation is complimentary; focused strategy sessions are a flat fee, credited toward your engagement. Full details and live availability are on the booking page.',
    surface: 'muted',
    columns: 2,
    items: [
      {
        name: 'Initial consultation',
        priceCents: 0,
        durationMin: 30,
        desc: 'A plain read on your matter and whether we’re the right fit.',
      },
      {
        name: 'Commercial litigation',
        priceCents: 35000,
        durationMin: 60,
        desc: 'Exposure, leverage and the realistic paths through a dispute.',
      },
      {
        name: 'Business formation',
        priceCents: 25000,
        durationMin: 45,
        desc: 'Entity, equity and agreements set up clean from day one.',
      },
      {
        name: 'M&A advisory',
        priceCents: 35000,
        durationMin: 60,
        desc: 'Structure, diligence and the terms worth holding.',
      },
    ],
    cta: { label: 'See all consultations & book', href: '/book' },
  }),
  splitFeature({
    image: url(IMG.office),
    alt: 'A modern downtown law office with floor-to-ceiling windows at dusk',
    heading: 'A boutique with a big firm’s reach',
    body: [
      'We built Meridian to give growing companies the caliber of counsel usually reserved for the largest players — without the layers, the handoffs and the padded invoices that come with them.',
      'Across formations, financings, contracts, disputes and exits, our partners have closed the deals and won the fights that decide where a company goes next. That track record is what you sit across from.',
    ],
    cta: { label: 'Schedule a consultation', href: '/book' },
  }),
  teamRow({
    heading: 'The partners you’ll work with',
    intro: 'Book directly with the attorney whose practice fits your matter — you deal with them, start to finish.',
    members: [
      {
        name: 'Marcus Reid',
        role: 'Managing partner · Corporate & M&A',
        image: url(IMG.marcus),
        alt: 'Marcus Reid, managing partner, corporate & M&A',
        bio: 'Formations, financings and the deals that move a company from one stage to the next.',
      },
      {
        name: 'Elena Vasquez',
        role: 'Partner · Litigation & Employment',
        image: url(IMG.elena),
        alt: 'Elena Vasquez, partner, commercial litigation & employment',
        bio: 'Commercial disputes and employment matters — measured out of court, decisive in it.',
      },
      {
        name: 'David Chen',
        role: 'Partner · IP & Contracts',
        image: url(IMG.david),
        alt: 'David Chen, partner, intellectual property & contracts',
        bio: 'Trademarks, licensing and the agreements that protect what a business is built on.',
      },
    ],
  }),
  testimonial({
    quote: 'We came to Meridian mid-acquisition, badly exposed. They restructured the deal in a week, closed it clean, and saved us a seven-figure problem we didn’t even know we had.',
    attribution: 'Dana Whitfield, CEO, Northline Logistics',
    surface: 'muted',
  }),
  bookingCta({
    title: 'Tell us what’s at stake',
    sub: 'Book a consultation and get a straight answer on your options, your exposure and what it will take. It starts with thirty minutes.',
    cta: { label: 'Schedule a consultation', href: '/book' },
  }),
];

const BOOK_INTRO = [
  photoHero({
    image: url(IMG.boardroom),
    alt: 'A sharp glass-walled boardroom set for a strategy session',
    title: 'Schedule a consultation',
    sub: 'Choose the consultation that fits your matter to see the fee, the length and live availability — then pick your attorney and time.',
    primary: { label: 'See consultations below', href: '/book' },
    overlay: 'darker',
    align: 'start',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.boardroom),
    alt: 'A sharp glass-walled boardroom set for a strategy session',
    heading: 'About Meridian Law Group',
    body: [
      'Meridian was founded on a simple frustration: capable companies were paying big-firm rates for counsel run by the least experienced people in the building. We do it the other way around — partners on the work, lean teams, and fees you agree to before we begin.',
      'We advise founders, operators and boards across corporate transactions, commercial litigation, employment and intellectual property. The common thread is judgment under pressure, when the outcome matters and the timeline is short.',
    ],
    cta: { label: 'Schedule a consultation', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'How we practice',
    items: [
      {
        title: 'Clarity before cost',
        body: 'Every matter starts with a scoped plan — what we’ll do, what it costs and the outcomes we’re aiming at. You decide with the numbers in front of you.',
      },
      {
        title: 'Positioned to win, ready to settle',
        body: 'We prepare every dispute as if it’s going the distance. That posture is exactly what resolves most of them on your terms, faster.',
      },
      {
        title: 'A partner, on the phone',
        body: 'You get a direct line to the attorney handling your work. No gatekeeping, no waiting a week to hear back on a live deal.',
      },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Visit the firm',
    address: ['Meridian Law Group', '400 Market Street, 22nd Floor', 'San Francisco, CA 94111'],
    mapLocation: '400 Market Street, San Francisco, CA 94111',
    hours: [
      { day: 'Monday – Thursday', time: '8:30 – 6:30' },
      { day: 'Friday', time: '8:30 – 5:30' },
      { day: 'Saturday – Sunday', time: 'By appointment' },
    ],
  }),
  bookingCta({
    title: 'Rather book than call?',
    sub: 'See live availability and reserve a consultation with the right attorney online — no phone tag.',
    surface: 'muted',
    cta: { label: 'Schedule a consultation', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-law-modern',
  name: 'Law Firm (Modern)',
  summary:
    'A sharp, modern business & litigation law-firm site — a midnight-slate palette, a confident blue accent and a precise modern sans. Installs a working consultation-booking flow: real consult types (litigation, formation, M&A, IP, employment), three partner attorneys booked by name with their own hours, and a credited-deposit policy. Ships as "Meridian Law Group", a boutique with big-firm reach.',
  tagline: 'A sharp, modern template for business & litigation firms — book consultations from day one.',
  industry: 'Law firm',
  sortWeight: 65,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'Meridian Law Group', tagline: 'Counsel that decides the outcome.' },
  theme: meridian,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Meridian Law Group — business & litigation attorneys',
      description:
        'Meridian Law Group is a boutique business and litigation firm handling corporate deals, commercial disputes, employment and IP. Schedule a consultation online.',
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
