// sparx-accounting-advisory — "Northpoint CPA", a modern CPA ADVISORY & wealth firm.
//
// The premium, data-forward advisory practice (tax strategy, CFO/advisory, business
// valuation, wealth & retirement planning) for established businesses and high earners:
// a deep-navy ground under a refined gold accent, a crisp serif display over a humanist
// sans, and a confident, precise structure that leads with strategy over friendliness.
// Deliberately the OPPOSITE of the sibling accounting template (a warm, approachable
// small-business bookkeeper) — same booking spine, a different business. The functional
// core is BOOKING A CONSULTATION, so the whole site points at "Book a strategy consultation".
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @wizeworks/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-accounting-advisory.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-accounting-advisory/**" \
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
  hero: 'accounting-advisory-hero',
  boardroom: 'accounting-advisory-boardroom',
  elena: 'accounting-advisory-elena',
  marcus: 'accounting-advisory-marcus',
  priya: 'accounting-advisory-priya',
} as const;

// EMPTY on purpose — the bundle ships with picsum fallbacks so nothing hot-links a stock
// host that can rot. Each seed is namespaced so the placeholders stay stable + unique.
const PHOTO: Record<string, string> = {
  "northpoint-hero": "https://images.unsplash.com/photo-1713461983836-de0a45009424?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZmluYW5jaWFsJTIwYWR2aXNvciUyMG9mZmljZXxlbnwwfDB8fHwxNzg2MzkwMDYxfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "northpoint-boardroom": "https://images.unsplash.com/photo-1431540015161-0bf868a2d407?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YnVzaW5lc3MlMjBtZWV0aW5nJTIwYm9hcmRyb29tfGVufDB8MHx8fDE3ODYzOTAwNjR8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "northpoint-elena": "https://images.unsplash.com/photo-1696960190591-60d693f4d50d?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YnVzaW5lc3N3b21hbiUyMHBvcnRyYWl0JTIwcHJvZmVzc2lvbmFsfGVufDB8MHx8fDE3ODYzOTAwNjd8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "northpoint-marcus": "https://images.unsplash.com/photo-1507679799987-c73779587ccf?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YnVzaW5lc3NtYW4lMjBwb3J0cmFpdCUyMHByb2Zlc3Npb25hbHxlbnwwfDB8fHwxNzg2MzkwMDcxfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "northpoint-priya": "https://images.unsplash.com/photo-1506863530036-1efeddceb993?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjBleGVjdXRpdmUlMjBwb3J0cmFpdHxlbnwwfDB8fHwxNzg2MzkwMDc0fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (seed: string): string =>
  PHOTO[seed] ?? `https://picsum.photos/seed/${seed}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}
const ASSETS: Asset[] = [
  { id: IMG.hero, url: src('northpoint-hero'), alt: 'A calm, glass-walled boardroom at dusk over a city skyline' },
  { id: IMG.boardroom, url: src('northpoint-boardroom'), alt: 'Advisors reviewing figures around a long table in soft light' },
  { id: IMG.elena, url: src('northpoint-elena'), alt: 'Elena Vasquez, CPA and managing partner' },
  { id: IMG.marcus, url: src('northpoint-marcus'), alt: 'Marcus Bell, CPA and CFO advisory lead' },
  { id: IMG.priya, url: src('northpoint-priya'), alt: 'Priya Anand, CFP and wealth planning director' },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-accounting-advisory: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "northpoint": soft-ivory ground, deep-navy primary, refined gold accent ─────
const northpoint = defineTheme({
  name: 'northpoint',
  type: { body: face('Inter', 'sans-serif'), head: face('Fraunces', 'serif') },
  shape: { selector: '0.25rem', field: '0.25rem', box: '0.375rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(97% 0.006 90)', // soft ivory
      'oklch(94% 0.008 88)', // pale parchment
      'oklch(89% 0.01 86)', // hairline
      'oklch(24% 0.035 255)', // deep navy ink
    ],
    roles: {
      primary: 'oklch(34% 0.07 258)', // deep navy
      secondary: 'oklch(38% 0.03 258)', // dark slate ink (readable micro-labels on ivory)
      accent: 'oklch(70% 0.11 85)', // refined gold
      neutral: 'oklch(28% 0.02 258)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(23% 0.02 258)', // deep navy-charcoal
      'oklch(19% 0.018 258)',
      'oklch(15% 0.014 258)',
      'oklch(94% 0.006 90)', // soft ivory ink
    ],
    roles: {
      primary: 'oklch(72% 0.09 258)', // lifted navy-blue
      secondary: 'oklch(80% 0.02 258)',
      accent: 'oklch(80% 0.12 85)', // brighter gold
      neutral: 'oklch(84% 0.015 258)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the booking spine (policies, advisors + hours, the consultation menu) ──
const hours = (days: number[], startMinute: number, endMinute: number) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

const SCHEDULING = {
  policies: [
    {
      handle: 'advisory-standard',
      name: 'Standard consultation',
      depositType: 'none',
      cancellationWindowHours: 48,
      reminderOffsetsMin: [2880, 1440, 120],
      policyText:
        'Please give us at least 48 hours’ notice to reschedule or cancel. We send reminders two days and one day ahead, and again two hours before your call.',
    },
    {
      handle: 'engagement-deposit',
      name: 'Engagement deposit',
      depositType: 'deposit',
      depositAmountCents: 15000,
      cancellationWindowHours: 48,
      reminderOffsetsMin: [2880, 1440, 120],
      policyText:
        'Paid advisory sessions hold a $150 deposit that applies to your engagement fee. Reschedule with 48 hours’ notice and it carries over in full.',
    },
  ],
  resources: [
    {
      handle: 'elena',
      name: 'Elena Vasquez, CPA',
      kind: 'staff',
      skillTags: ['tax-strategy', 'advisory', 'valuation', 'entity-structuring'],
      windows: hours([1, 2, 3, 4, 5], 510, 1050), // Mon–Fri 8:30–5:30
    },
    {
      handle: 'priya',
      name: 'Priya Anand, CFP',
      kind: 'staff',
      skillTags: ['wealth', 'retirement', 'tax-strategy', 'advisory'],
      windows: hours([1, 2, 3, 4], 540, 1080), // Mon–Thu 9–6
    },
    {
      handle: 'marcus',
      name: 'Marcus Bell, CPA',
      kind: 'staff',
      skillTags: ['cfo', 'advisory', 'valuation', 'entity-structuring'],
      windows: hours([2, 3, 4, 5], 540, 1020), // Tue–Fri 9–5
    },
  ],
  services: [
    {
      handle: 'strategy-consultation',
      name: 'Strategy consultation',
      description: 'A complimentary 45-minute call to understand your situation and map where we can add the most value — no obligation.',
      durationMinutes: 45,
      priceCents: 0,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'advisor', kind: 'staff', skillTags: ['advisory'], count: 1 }],
      policyHandle: 'advisory-standard',
    },
    {
      handle: 'tax-strategy-review',
      name: 'Tax strategy review',
      description: 'A working session on proactive, forward-looking tax planning — entity elections, timing, deductions and multi-year strategy.',
      durationMinutes: 60,
      priceCents: 45000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'advisor', kind: 'staff', skillTags: ['advisory'], count: 1 }],
      policyHandle: 'engagement-deposit',
    },
    {
      handle: 'cfo-advisory-consult',
      name: 'CFO advisory consult',
      description: 'Outsourced-CFO guidance on cash flow, margins, forecasting and the numbers behind your next decision.',
      durationMinutes: 60,
      priceCents: 55000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'advisor', kind: 'staff', skillTags: ['advisory'], count: 1 }],
      policyHandle: 'engagement-deposit',
    },
    {
      handle: 'business-valuation-consult',
      name: 'Business valuation consult',
      description: 'A defensible valuation conversation for a sale, buy-in, succession or estate — what the business is worth and why.',
      durationMinutes: 60,
      priceCents: 75000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'advisor', kind: 'staff', skillTags: ['advisory'], count: 1 }],
      policyHandle: 'engagement-deposit',
    },
    {
      handle: 'wealth-planning-consult',
      name: 'Wealth planning consult',
      description: 'A personal-wealth session — investment structure, tax-efficient drawdown and a plan that ties your business and personal finances together.',
      durationMinutes: 60,
      priceCents: 50000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'advisor', kind: 'staff', skillTags: ['advisory'], count: 1 }],
      policyHandle: 'engagement-deposit',
    },
    {
      handle: 'retirement-planning-consult',
      name: 'Retirement planning consult',
      description: 'Retirement and succession modeling — contribution strategy, exit timing and the income you’ll actually live on.',
      durationMinutes: 60,
      priceCents: 45000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'advisor', kind: 'staff', skillTags: ['advisory'], count: 1 }],
      policyHandle: 'engagement-deposit',
    },
    {
      handle: 'entity-structuring-consult',
      name: 'Entity structuring consult',
      description: 'The right structure for what’s next — S-corp vs. C-corp, holding companies and multi-entity design done for the long game.',
      durationMinutes: 45,
      priceCents: 45000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'advisor', kind: 'staff', skillTags: ['advisory'], count: 1 }],
      policyHandle: 'engagement-deposit',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  photoHero({
    image: url(IMG.hero),
    alt: 'A calm, glass-walled boardroom at dusk over a city skyline',
    title: 'Advisory that works before the tax bill does',
    sub: 'Proactive tax strategy, CFO-level insight and wealth planning for established businesses and high earners — built around where you’re going, not just what already happened.',
    primary: { label: 'Book a strategy consultation', href: '/book' },
    secondary: { label: 'See how we work', href: '/book' },
    overlay: 'darker',
  }),
  featureRow({
    items: [
      {
        title: 'Proactive tax strategy',
        body: 'We plan the year, not just file it — the moves that lower next April’s bill are made in the months before it, together.',
      },
      {
        title: 'A dedicated CPA advisor',
        body: 'You work with one senior advisor who knows your numbers and your goals — not a rotating desk and a portal ticket.',
      },
      {
        title: 'Quarterly business reviews',
        body: 'A standing conversation about margins, cash and what’s next, so decisions are made on real figures instead of a gut feel.',
      },
    ],
  }),
  serviceMenu({
    heading: 'Ways to work with us',
    intro: 'Every relationship starts with a complimentary strategy call. Paid advisory sessions apply toward your engagement. Full details and live availability are on the booking page.',
    surface: 'muted',
    columns: 2,
    items: [
      { name: 'Strategy consultation', priceCents: 0, durationMin: 45, desc: 'A complimentary call to map where we can help most.' },
      { name: 'Tax strategy review', priceCents: 45000, durationMin: 60, desc: 'Forward-looking, multi-year tax planning.' },
      { name: 'CFO advisory consult', priceCents: 55000, durationMin: 60, desc: 'Cash flow, margins and the numbers behind the call.' },
      { name: 'Business valuation consult', priceCents: 75000, durationMin: 60, desc: 'A defensible number for a sale, buy-in or exit.' },
      { name: 'Wealth planning consult', priceCents: 50000, durationMin: 60, desc: 'Tax-efficient wealth, business and personal, aligned.' },
      { name: 'Retirement planning consult', priceCents: 45000, durationMin: 60, desc: 'Contribution strategy, exit timing and real income.' },
    ],
    cta: { label: 'See everything & book', href: '/book' },
  }),
  splitFeature({
    image: url(IMG.boardroom),
    alt: 'Advisors reviewing figures around a long table in soft light',
    heading: 'The advisory approach',
    body: [
      'Most firms show up at tax time to record what already happened. We work the other way around — the strategy is set early, revisited every quarter, and measured against the goals you actually care about.',
      'The result is fewer surprises, a lower long-run tax burden, and a clear line of sight from this year’s decisions to where the business and your wealth are headed.',
    ],
    cta: { label: 'Book a strategy consultation', href: '/book' },
  }),
  teamRow({
    heading: 'Your advisory team',
    intro: 'Book by name — you’ll work with the same advisor from the first call onward.',
    members: [
      { name: 'Elena Vasquez, CPA', role: 'Managing partner', image: url(IMG.elena), alt: 'Elena Vasquez, CPA and managing partner', bio: 'Tax strategy, entity structuring and valuation for founders and high earners.' },
      { name: 'Marcus Bell, CPA', role: 'CFO advisory lead', image: url(IMG.marcus), alt: 'Marcus Bell, CPA and CFO advisory lead', bio: 'Outsourced-CFO guidance — forecasting, margins and the decisions behind them.' },
      { name: 'Priya Anand, CFP', role: 'Wealth planning director', image: url(IMG.priya), alt: 'Priya Anand, CFP and wealth planning director', bio: 'Wealth, retirement and succession planning that ties business to personal.' },
    ],
  }),
  testimonial({
    quote: 'They restructured our entities and rebuilt our tax plan in the first quarter. We kept an extra $180K last year — and for the first time I actually understand why.',
    attribution: 'Daniel R., founder of a $9M services firm',
    surface: 'primary',
  }),
  bookingCta({
    title: 'Start with a strategy conversation',
    sub: 'A complimentary 45-minute call. Pick your advisor, choose a time, and see exactly where we can add value. It takes about a minute to book.',
    cta: { label: 'Book a strategy consultation', href: '/book' },
  }),
];

const BOOK_INTRO = [
  photoHero({
    image: url(IMG.boardroom),
    alt: 'Advisors reviewing figures around a long table in soft light',
    title: 'Book your consultation',
    sub: 'Choose a session to see the fee and live availability, then pick your advisor and a time that works. Every engagement begins with a complimentary strategy call.',
    primary: { label: 'See sessions below', href: '/book' },
    overlay: 'darker',
    align: 'start',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.hero),
    alt: 'A calm, glass-walled boardroom at dusk over a city skyline',
    heading: 'About Northpoint CPA',
    body: [
      'Northpoint CPA is a modern advisory and wealth practice for established businesses and the people who run them. We pair the rigor of a traditional CPA firm with the forward view of a CFO and the discipline of a private wealth office.',
      'We took the parts of accounting that clients value — the strategy, the counsel, the person who knows their whole picture — and made them the whole relationship, not the afterthought at year-end.',
    ],
    cta: { label: 'Book a strategy consultation', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'How we work',
    items: [
      { title: 'Strategy first', body: 'Every engagement opens with a real conversation about the business, the numbers and where you want to be in three years.' },
      { title: 'One advisor, whole picture', body: 'Your advisor holds the full view — tax, cash flow, valuation and personal wealth — so the advice is joined-up, never siloed.' },
      { title: 'Measured every quarter', body: 'We revisit the plan on a standing quarterly cadence, so strategy keeps pace with the business instead of drifting out of date.' },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Visit the office',
    address: ['Northpoint CPA', '4200 Meridian Avenue', 'Suite 900 · Denver, CO 80202'],
    mapLocation: '4200 Meridian Avenue, Denver, CO 80202',
    hours: [
      { day: 'Monday – Thursday', time: '8:30 – 5:30' },
      { day: 'Friday', time: '9:00 – 5:00' },
      { day: 'Saturday', time: 'By appointment' },
      { day: 'Sunday', time: 'Closed' },
    ],
  }),
  bookingCta({
    title: 'Rather book than call?',
    sub: 'See live availability and reserve your complimentary strategy call online — no phone tag.',
    surface: 'muted',
    cta: { label: 'Book a strategy consultation', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-accounting-advisory',
  name: 'Accounting (Advisory)',
  summary:
    'A premium CPA advisory and wealth site — a deep-navy palette with a refined gold accent and a data-forward layout. Installs a working consultation-booking flow: a real menu of advisory sessions (tax strategy, CFO advisory, business valuation, wealth and retirement planning), three CPAs and advisors you book by name with their own hours, and a complimentary initial strategy call. Ships as "Northpoint CPA", a modern firm for established businesses and high earners.',
  tagline: 'A premium, advisory-led template for CPA and wealth firms — book consultations from day one.',
  industry: 'Accounting',
  sortWeight: 63,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'Northpoint CPA', tagline: 'Advisory-led accounting and wealth.' },
  theme: northpoint,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Northpoint CPA — advisory-led accounting & wealth',
      description:
        'Northpoint CPA is a modern advisory and wealth firm — proactive tax strategy, CFO-level insight and wealth planning for established businesses and high earners. Book a strategy consultation online.',
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
