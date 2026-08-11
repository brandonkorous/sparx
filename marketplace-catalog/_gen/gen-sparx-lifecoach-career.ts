// sparx-lifecoach-career — "Ascend Coaching", a sharp CAREER / EXECUTIVE coaching practice.
//
// The results-focused career-and-leadership coach of the professional lane: a crisp
// near-white ground, a deep-navy primary, a confident amber accent, and a modern sans
// (Space Grotesk display over Inter body). Empowering, deliberate, outcome-driven —
// coaching for ambitious professionals navigating transitions, executive presence,
// leadership and interview & promotion prep. Deliberately the SHARP, professional sibling
// of the warm life/wellness coaching template (soft, restorative, feelings-first) — same
// booking spine, a visibly different business: a confident palette, a modern display type,
// a decisive structure whose functional core is BOOKING A DISCOVERY CALL.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-lifecoach-career.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-lifecoach-career/**" \
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
  method: 'lifecoach-career-method',
  about: 'lifecoach-career-about',
  daniela: 'lifecoach-career-daniela',
  marcus: 'lifecoach-career-marcus',
  priya: 'lifecoach-career-priya',
} as const;

const PHOTO: Record<string, string> = {
  "ascend-method": "https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YnVzaW5lc3MlMjBwcm9mZXNzaW9uYWwlMjB3b3JraW5nfGVufDB8MHx8fDE3ODYzOTU2NzJ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "ascend-about": "https://images.unsplash.com/photo-1745970649913-2edb9dca4f74?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y29hY2hpbmclMjBzZXNzaW9uJTIwb2ZmaWNlfGVufDB8MHx8fDE3ODYzOTU2NzV8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "ascend-daniela": "https://images.unsplash.com/photo-1696960190591-60d693f4d50d?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YnVzaW5lc3N3b21hbiUyMHBvcnRyYWl0JTIwcHJvZmVzc2lvbmFsfGVufDB8MHx8fDE3ODYzOTU2Nzl8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "ascend-marcus": "https://images.unsplash.com/photo-1507679799987-c73779587ccf?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YnVzaW5lc3NtYW4lMjBwb3J0cmFpdCUyMHByb2Zlc3Npb25hbHxlbnwwfDB8fHwxNzg2MzkwMDcxfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "ascend-priya": "https://images.unsplash.com/photo-1506863530036-1efeddceb993?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjBleGVjdXRpdmUlMjBwb3J0cmFpdHxlbnwwfDB8fHwxNzg2Mzk1NjgzfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
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
    id: IMG.method,
    url: src('ascend-method'),
    alt: 'A focused professional mapping out a career plan on a whiteboard',
  },
  {
    id: IMG.about,
    url: src('ascend-about'),
    alt: 'A confident one-to-one coaching conversation over video',
  },
  {
    id: IMG.daniela,
    url: src('ascend-daniela'),
    alt: 'Daniela Reyes, executive and leadership coach',
  },
  {
    id: IMG.marcus,
    url: src('ascend-marcus'),
    alt: 'Marcus Bell, career and leadership coach',
  },
  {
    id: IMG.priya,
    url: src('ascend-priya'),
    alt: 'Priya Anand, career transition and interview coach',
  },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-lifecoach-career: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "ascend": near-white ground, deep-navy primary, amber accent, modern sans ─
const ascend = defineTheme({
  name: 'ascend',
  type: { body: face('Inter', 'sans-serif'), head: face('Space Grotesk', 'sans-serif') },
  shape: { selector: '0.25rem', field: '0.25rem', box: '0.375rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(98.5% 0.004 250)', // crisp near-white
      'oklch(96% 0.006 252)', // cool paper
      'oklch(90% 0.013 255)', // hairline
      'oklch(23% 0.03 258)', // deep navy ink
    ],
    roles: {
      primary: 'oklch(40% 0.11 258)', // deep navy
      secondary: 'oklch(34% 0.02 260)', // dark readable slate
      accent: 'oklch(78% 0.14 74)', // confident amber
      neutral: 'oklch(28% 0.02 260)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(20% 0.025 260)',
      'oklch(16% 0.02 260)',
      'oklch(13% 0.015 260)',
      'oklch(95% 0.005 250)',
    ],
    roles: {
      primary: 'oklch(70% 0.12 256)', // bright confident blue
      secondary: 'oklch(76% 0.02 258)',
      accent: 'oklch(81% 0.13 78)',
      neutral: 'oklch(82% 0.018 260)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the booking spine (policies, coaches + hours, the session menu) ──────
const hours = (days: number[], startMinute: number, endMinute: number) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

const SCHEDULING = {
  policies: [
    {
      handle: 'coaching-standard',
      name: 'Standard booking',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [1440, 120],
      policyText:
        'Please give at least 24 hours’ notice to reschedule or cancel — no charge when you let us know in time. We send a reminder the day before and two hours ahead.',
    },
    {
      handle: 'coaching-no-show',
      name: 'Session hold',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [2880, 1440, 120],
      policyText:
        'Booked sessions are time held just for you. Reschedule with 24 hours’ notice at no cost; a missed session or a same-day cancellation is billed as the full fee so your coach’s time is respected.',
    },
  ],
  resources: [
    {
      handle: 'daniela',
      name: 'Daniela Reyes',
      kind: 'staff',
      skillTags: ['executive', 'leadership', 'general'],
      // Mon–Thu mornings 7–12 + Mon/Wed evenings 5–9
      windows: [...hours([1, 2, 3, 4], 420, 720), ...hours([1, 3], 1020, 1260)],
    },
    {
      handle: 'marcus',
      name: 'Marcus Bell',
      kind: 'staff',
      skillTags: ['career', 'leadership', 'general'],
      // Tue–Fri 8–1 + Tue/Thu evenings 5–8
      windows: [...hours([2, 3, 4, 5], 480, 780), ...hours([2, 4], 1020, 1200)],
    },
    {
      handle: 'priya',
      name: 'Priya Anand',
      kind: 'staff',
      skillTags: ['transition', 'interview', 'general'],
      // Mon/Wed/Fri 9–2 + Wed evening 5–8 + Sat morning 9–12
      windows: [...hours([1, 3, 5], 540, 840), ...hours([3], 1020, 1200), ...hours([6], 540, 720)],
    },
  ],
  services: [
    {
      handle: 'discovery-call',
      name: 'Discovery call',
      description:
        'A free 30-minute call to hear your goals, talk through where you are and match you with the right coach. No cost, no pitch.',
      durationMinutes: 30,
      priceCents: 0,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'coach', kind: 'staff', skillTags: ['general'], count: 1 },
      ],
      policyHandle: 'coaching-standard',
    },
    {
      handle: 'career-strategy-session',
      name: 'Career strategy session',
      description:
        'A focused working session to name your next move and reverse-engineer the plan — the conversations, the visibility and the skills that get you there.',
      durationMinutes: 60,
      priceCents: 20000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'coach', kind: 'staff', skillTags: ['general'], count: 1 },
      ],
      policyHandle: 'coaching-no-show',
    },
    {
      handle: 'executive-coaching-session',
      name: 'Executive coaching session',
      description:
        'One-to-one coaching for senior leaders — executive presence, influence and high-stakes decision-making, with a coach who’s led at the top.',
      durationMinutes: 60,
      priceCents: 25000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'coach', kind: 'staff', skillTags: ['executive'], count: 1 },
      ],
      policyHandle: 'coaching-no-show',
    },
    {
      handle: 'leadership-coaching-session',
      name: 'Leadership coaching session',
      description:
        'Grow into the leader the role needs — managing up, leading a team for the first time, and building the confidence to make the call.',
      durationMinutes: 60,
      priceCents: 22000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'coach', kind: 'staff', skillTags: ['leadership'], count: 1 },
      ],
      policyHandle: 'coaching-no-show',
    },
    {
      handle: 'interview-prep-session',
      name: 'Interview prep session',
      description:
        'Walk in ready — sharpen your positioning, rehearse the hard questions and turn your story into answers that land.',
      durationMinutes: 45,
      priceCents: 18000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'coach', kind: 'staff', skillTags: ['general'], count: 1 },
      ],
      policyHandle: 'coaching-standard',
    },
    {
      handle: 'promotion-strategy-session',
      name: 'Promotion strategy session',
      description:
        'Build the case for your promotion — the results to surface, the stakeholders to win over and the ask that makes it obvious.',
      durationMinutes: 45,
      priceCents: 19000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'coach', kind: 'staff', skillTags: ['general'], count: 1 },
      ],
      policyHandle: 'coaching-no-show',
    },
    {
      handle: 'coaching-package-consult',
      name: 'Coaching package consult',
      description:
        'A short call to walk through our multi-session coaching packages and find the engagement that fits your goals and timeline.',
      durationMinutes: 30,
      priceCents: 5000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'coach', kind: 'staff', skillTags: ['general'], count: 1 },
      ],
      policyHandle: 'coaching-standard',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  typeHero({
    title: 'Take charge of where your career goes',
    sub: 'One-to-one coaching for ambitious professionals — sharpen your executive presence, navigate the next move, and get promoted on purpose. It starts with one honest conversation.',
    primary: { label: 'Book a discovery call', href: '/book' },
    secondary: { label: 'See how it works', href: '/book' },
    surface: 'base',
  }),
  featureRow({
    heading: 'Why professionals choose Ascend',
    items: [
      {
        title: 'Certified executive coaches',
        body: 'Work with credentialed coaches who’ve sat in the leadership seat — not theorists, but practitioners who’ve led teams and hired for the roles you want.',
      },
      {
        title: 'Proven frameworks',
        body: 'Every session runs on tested models for goal-setting, executive presence and decision-making — structure you can put to work the moment the call ends.',
      },
      {
        title: 'Career & leadership focus',
        body: 'This is coaching built for professionals on the rise — transitions, promotions, first-time leadership and the jump to the executive table.',
      },
      {
        title: 'Flexible virtual sessions',
        body: 'Meet by secure video around a real schedule — early mornings and evenings included, so your momentum never waits for a free afternoon.',
      },
    ],
  }),
  serviceMenu({
    heading: 'Ways to work together',
    intro:
      'Every engagement opens with a free discovery call. From there, choose a single focused session or an ongoing package. Full fees and live availability are on the booking page.',
    surface: 'muted',
    columns: 2,
    items: [
      {
        name: 'Discovery call',
        priceCents: 0,
        durationMin: 30,
        desc: 'A free, no-pressure call to map your goals and find your fit.',
      },
      {
        name: 'Career strategy session',
        priceCents: 20000,
        durationMin: 60,
        desc: 'Build a clear, deadline-backed plan for your next move.',
      },
      {
        name: 'Executive coaching session',
        priceCents: 25000,
        durationMin: 60,
        desc: 'Sharpen presence, influence and decision-making at the top.',
      },
      {
        name: 'Interview prep session',
        priceCents: 18000,
        durationMin: 45,
        desc: 'Walk in ready — positioning, stories and the hard questions.',
      },
    ],
    cta: { label: 'See everything & book', href: '/book' },
  }),
  splitFeature({
    image: url(IMG.method),
    alt: 'A focused professional mapping out a career plan on a whiteboard',
    heading: 'A method that turns ambition into offers',
    body: [
      'Motivation fades; a system doesn’t. Every engagement starts by naming exactly where you want to be in six months, then reverse-engineers the moves — the conversations, the visibility, the skills — that get you there.',
      'You leave each session with specific actions and a way to measure them, so progress is something you can see on a calendar, not just feel. The result is fewer sideways years and more deliberate, well-timed leaps.',
    ],
    cta: { label: 'Book a discovery call', href: '/book' },
  }),
  teamRow({
    heading: 'Meet your coaches',
    intro: 'Book by name — you’ll work with the same coach throughout, someone who learns your goals and holds you to them.',
    members: [
      {
        name: 'Daniela Reyes',
        role: 'Executive & leadership coach',
        image: url(IMG.daniela),
        alt: 'Daniela Reyes, executive and leadership coach',
        bio: 'Fifteen years leading operations at scale. Daniela coaches senior leaders on presence and the executive jump.',
      },
      {
        name: 'Marcus Bell',
        role: 'Career & leadership coach',
        image: url(IMG.marcus),
        alt: 'Marcus Bell, career and leadership coach',
        bio: 'A former hiring director who coaches ambitious professionals through promotions and first-time leadership.',
      },
      {
        name: 'Priya Anand',
        role: 'Transition & interview coach',
        image: url(IMG.priya),
        alt: 'Priya Anand, career transition and interview coach',
        bio: 'Career pivots and interview prep. Priya turns a messy job search into a focused, confident campaign.',
      },
    ],
  }),
  testimonial({
    quote:
      'Six months in, I went from passed over to promoted to director — with a raise I’d never have asked for on my own. The plan made the ask obvious.',
    attribution: 'Rachel M., Director of Operations',
  }),
  bookingCta({
    title: 'Your next move is a conversation away',
    sub: 'Start with a free 30-minute discovery call — no cost, no pitch, just a clear read on where you are and where you could be. It takes about a minute to book.',
    cta: { label: 'Book a discovery call', href: '/book' },
  }),
];

const BOOK_INTRO = [
  typeHero({
    title: 'Book your discovery call',
    sub: 'Choose a session to see live availability, then pick your coach and a time that works for you. New here? Start with the free discovery call — it’s the right first step.',
    primary: { label: 'See sessions below', href: '/book' },
    surface: 'muted',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.about),
    alt: 'A confident one-to-one coaching conversation over video',
    heading: 'About Ascend Coaching',
    body: [
      'Ascend exists for the professionals who know they’re capable of more and are done leaving the next move to chance. We pair ambition with a plan — and a coach who’s been there — so the growth you want stops being someday and starts being scheduled.',
      'No fluff, no motivational posters. Just clear goals, honest feedback and a structured path to the role, the raise and the confidence you’re after. Your ambition is the fuel; our job is the map and the accountability.',
    ],
    cta: { label: 'Book a discovery call', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'What we believe',
    items: [
      {
        title: 'Careers are built, not waited for',
        body: 'The best moves rarely happen by luck. A clear plan and a few deliberate actions beat years of hoping to be noticed.',
      },
      {
        title: 'Feedback is a gift',
        body: 'Growth needs someone who’ll tell you the truth — kindly, directly, and with a way forward. That honesty is the whole point.',
      },
      {
        title: 'Momentum compounds',
        body: 'Small, consistent wins stack into big leaps. We measure progress every session so you can see it, not just feel it.',
      },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Reach the practice',
    address: [
      'Ascend Coaching',
      'Virtual coaching, nationwide · secure video sessions',
      'Mailing: 400 Market Street, Suite 12 · San Francisco, CA 94111',
    ],
    mapLocation: '400 Market Street, San Francisco, CA 94111',
    hours: [
      { day: 'Monday – Thursday', time: '7:00 – 9:00 (mornings & evenings)' },
      { day: 'Friday', time: '8:00 – 2:00' },
      { day: 'Saturday', time: '9:00 – 12:00' },
      { day: 'Sunday', time: 'By arrangement' },
    ],
  }),
  bookingCta({
    title: 'Rather book than email?',
    sub: 'See live availability and reserve your free discovery call online — no phone tag, no back-and-forth.',
    surface: 'muted',
    cta: { label: 'Book a discovery call', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-lifecoach-career',
  name: 'sparx — Life Coaching (Career)',
  summary:
    'A sharp, empowering career-coaching site — a deep-navy palette, a confident amber accent and a modern sans, built for ambitious professionals. Installs a working booking flow: a free discovery call plus career-strategy, executive, leadership, interview-prep and promotion sessions, three coaches you book by name with evening hours, and a no-show policy. Ships as "Ascend Coaching", a results-focused practice you can book in about a minute.',
  tagline: 'A sharp template for career & executive coaches — book discovery calls from day one.',
  industry: 'Life coaching',
  sortWeight: 12,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'Ascend Coaching', tagline: 'Ambition, with a plan.' },
  theme: ascend,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Ascend Coaching — career & executive coaching',
      description:
        'Ascend is a results-focused coaching practice for ambitious professionals — career strategy, executive presence, leadership and interview prep by secure video. Book a free discovery call.',
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
