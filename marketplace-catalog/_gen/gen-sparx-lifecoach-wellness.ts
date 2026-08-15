// sparx-lifecoach-wellness — "Brightpath Life Coaching", a warm LIFE & WELLNESS coaching practice.
//
// The encouraging, human coaching studio: a warm cream ground, a terracotta primary, a
// soft-sage accent and a warm humanist serif display over a clean sans, with hopeful,
// natural-light photography carrying the page. Deliberately the WARM sibling of the sharp
// career/executive coaching template (navy, modern, corporate) — same discovery-call
// booking spine, a visibly different, softer, transformation-led business.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-lifecoach-wellness.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-lifecoach-wellness/**" \
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
  hero: 'lifecoach-wellness-hero',
  approach: 'lifecoach-wellness-approach',
  about: 'lifecoach-wellness-about',
  elena: 'lifecoach-wellness-elena',
  marcus: 'lifecoach-wellness-marcus',
  priya: 'lifecoach-wellness-priya',
} as const;

const PHOTO: Record<string, string> = {
  "brightpath-hero": "https://images.unsplash.com/photo-1522075782449-e45a34f1ddfb?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGVyc29uJTIwY2FsbSUyMG5hdHVyZSUyMHN1bnJpc2V8ZW58MHwwfHx8MTc4NjM5NTY4Nnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "brightpath-approach": "https://images.unsplash.com/photo-1558210834-473f430c09ac?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8am91cm5hbGluZyUyMGNvZmZlZSUyMGNhbG18ZW58MHwwfHx8MTc4NjM5NTY5MHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "brightpath-about": "https://images.unsplash.com/photo-1612994451093-c6791c8989cd?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjBzbWlsaW5nJTIwb3V0ZG9vcnN8ZW58MHwwfHx8MTc4NjM5NTY5M3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "brightpath-elena": "https://images.unsplash.com/photo-1506863530036-1efeddceb993?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjBjb2FjaCUyMHBvcnRyYWl0fGVufDB8MHx8fDE3ODYzOTU2OTZ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "brightpath-marcus": "https://images.unsplash.com/photo-1568602471122-7832951cc4c5?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bWFuJTIwcG9ydHJhaXQlMjBmcmllbmRseXxlbnwwfDB8fHwxNzg2Mzk1Njk5fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "brightpath-priya": "https://images.unsplash.com/photo-1485178575877-1a13bf489dfe?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjBwb3J0cmFpdCUyMHdhcm18ZW58MHwwfHx8MTc4NjM5NTcwMnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
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
    url: src('brightpath-hero'),
    alt: 'A person smiling in warm morning light, looking hopeful and at ease',
  },
  {
    id: IMG.approach,
    url: src('brightpath-approach'),
    alt: 'A calm, sunlit corner with a notebook and a warm cup of tea',
  },
  {
    id: IMG.about,
    url: src('brightpath-about'),
    alt: 'Two people in relaxed conversation on a bright video call',
  },
  { id: IMG.elena, url: src('brightpath-elena'), alt: 'Elena Ross, life & transitions coach' },
  { id: IMG.marcus, url: src('brightpath-marcus'), alt: 'Marcus Bell, confidence & habits coach' },
  { id: IMG.priya, url: src('brightpath-priya'), alt: 'Priya Anand, purpose & balance coach' },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-lifecoach-wellness: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "brightpath": warm cream ground, terracotta primary, soft-sage accent, serif ─
const brightpath = defineTheme({
  name: 'brightpath',
  type: { body: face('Inter', 'sans-serif'), head: face('Fraunces', 'serif') },
  shape: { selector: '0.75rem', field: '0.75rem', box: '1rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(97% 0.014 78)', // warm cream
      'oklch(94% 0.02 74)', // soft oat
      'oklch(89% 0.026 70)', // sand hairline
      'oklch(29% 0.024 46)', // warm cocoa ink
    ],
    roles: {
      primary: 'oklch(66% 0.13 42)', // terracotta / warm coral
      secondary: 'oklch(40% 0.028 48)', // deep warm cocoa (readable micro-labels)
      accent: 'oklch(70% 0.07 150)', // soft sage
      neutral: 'oklch(30% 0.022 46)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(24% 0.02 46)',
      'oklch(20% 0.016 46)',
      'oklch(16% 0.012 46)',
      'oklch(95% 0.012 80)',
    ],
    roles: {
      primary: 'oklch(74% 0.12 44)', // warmed terracotta for dark ground
      secondary: 'oklch(80% 0.02 70)',
      accent: 'oklch(76% 0.08 150)',
      neutral: 'oklch(84% 0.016 70)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the booking spine (policies, coaches + hours, the coaching menu) ──────
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
        'Life happens — just give us at least 24 hours’ notice to reschedule and we’ll find another time that fits. We send a friendly reminder the day before and two hours ahead.',
    },
    {
      handle: 'no-show',
      name: 'Missed-session policy',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [2880, 1440, 120],
      policyText:
        'If a session is missed without notice, we count it as used so we can keep time open for everyone. Reach out ahead of time and we’ll always work with you.',
    },
  ],
  resources: [
    {
      handle: 'elena',
      name: 'Elena Ross',
      kind: 'staff',
      skillTags: ['life', 'mindset', 'general'],
      windows: hours([1, 2, 3, 4], 540, 1020), // Mon–Thu 9–5 (virtual)
    },
    {
      handle: 'marcus',
      name: 'Marcus Bell',
      kind: 'staff',
      skillTags: ['confidence', 'habits', 'general'],
      windows: hours([2, 3, 4, 5], 600, 1140), // Tue–Fri 10–7 (virtual)
    },
    {
      handle: 'priya',
      name: 'Priya Anand',
      kind: 'staff',
      skillTags: ['purpose', 'balance', 'general'],
      windows: hours([1, 3, 4, 6], 600, 1080), // Mon, Wed, Thu, Sat 10–6 (virtual)
    },
  ],
  services: [
    {
      handle: 'discovery-call',
      name: 'Free discovery call',
      description:
        'A relaxed, no-pressure 30 minutes to talk through what’s on your mind and see if coaching is the right fit. Completely free.',
      durationMinutes: 30,
      priceCents: 0,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'coach', kind: 'staff', skillTags: ['general'], count: 1 }],
      policyHandle: 'coaching-standard',
    },
    {
      handle: 'life-coaching-session',
      name: 'Life coaching session',
      description:
        'A focused one-on-one session to work through a change, a decision or a season of life — at your pace, with real support.',
      durationMinutes: 60,
      priceCents: 12000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'coach', kind: 'staff', skillTags: ['general'], count: 1 }],
      policyHandle: 'coaching-standard',
    },
    {
      handle: 'mindset-session',
      name: 'Mindset & resilience session',
      description:
        'Reframe the thoughts that hold you back and build a steadier, kinder inner voice you can carry into everyday life.',
      durationMinutes: 60,
      priceCents: 12000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'coach', kind: 'staff', skillTags: ['mindset'], count: 1 }],
      policyHandle: 'coaching-standard',
    },
    {
      handle: 'confidence-session',
      name: 'Confidence & self-worth session',
      description:
        'Practical, warm work on speaking up, setting boundaries and trusting yourself — so you show up as you, without apology.',
      durationMinutes: 60,
      priceCents: 12000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'coach', kind: 'staff', skillTags: ['general'], count: 1 }],
      policyHandle: 'coaching-standard',
    },
    {
      handle: 'work-life-balance-session',
      name: 'Work–life balance session',
      description:
        'Untangle the overwhelm and rebuild a week that has room for the things that matter — rest, people and you.',
      durationMinutes: 60,
      priceCents: 12000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'coach', kind: 'staff', skillTags: ['general'], count: 1 }],
      policyHandle: 'coaching-standard',
    },
    {
      handle: 'purpose-clarity-session',
      name: 'Purpose & clarity session',
      description:
        'A deeper session to reconnect with what you actually want, and map a next step that feels true to you.',
      durationMinutes: 60,
      priceCents: 13500,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'coach', kind: 'staff', skillTags: ['general'], count: 1 }],
      policyHandle: 'coaching-standard',
    },
    {
      handle: 'coaching-package-consult',
      name: 'Coaching package consult',
      description:
        'A 45-minute planning session to shape a multi-week coaching journey around your goals, pace and budget.',
      durationMinutes: 45,
      priceCents: 9000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'coach', kind: 'staff', skillTags: ['general'], count: 1 }],
      policyHandle: 'coaching-standard',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  photoHero({
    image: url(IMG.hero),
    alt: 'A person smiling in warm morning light, looking hopeful and at ease',
    title: 'Your next chapter starts with one conversation',
    sub: 'Warm, judgment-free coaching for the moments that ask for change — a new season, a big decision, or simply wanting to feel more like yourself again.',
    primary: { label: 'Book a free discovery call', href: '/book' },
    secondary: { label: 'See how we help', href: '/book' },
    overlay: 'dark',
  }),
  featureRow({
    items: [
      {
        title: 'Certified life coaches',
        body: 'Trained, credentialed coaches who’ve guided hundreds of people through real change — not generic advice from a book.',
      },
      {
        title: 'Judgment-free & supportive',
        body: 'A safe, encouraging space to say the thing out loud. No shame, no fixing you — just steady support and honest reflection.',
      },
      {
        title: 'Practical tools you’ll use',
        body: 'Every session ends with something to carry into your week — a small step, a reframe, a habit that actually sticks.',
      },
      {
        title: 'Flexible virtual sessions',
        body: 'Meet from wherever you feel comfortable. Evenings and weekends available, so coaching fits your life, not the other way around.',
      },
    ],
  }),
  serviceMenu({
    heading: 'Ways we can work together',
    intro: 'Start with a free discovery call, then choose the sessions that fit where you are. Full details and live availability are on the booking page.',
    surface: 'muted',
    columns: 2,
    items: [
      { name: 'Free discovery call', priceCents: 0, durationMin: 30, desc: 'A no-pressure chat to see if we’re the right fit.' },
      { name: 'Life coaching session', priceCents: 12000, durationMin: 60, desc: 'One-on-one support through a change or decision.' },
      { name: 'Mindset & resilience', priceCents: 12000, durationMin: 60, desc: 'Reframe the thoughts that hold you back.' },
      { name: 'Purpose & clarity', priceCents: 13500, durationMin: 60, desc: 'Reconnect with what you really want next.' },
    ],
    cta: { label: 'See everything & book', href: '/book' },
  }),
  splitFeature({
    image: url(IMG.approach),
    alt: 'A calm, sunlit corner with a notebook and a warm cup of tea',
    heading: 'Change happens one gentle shift at a time',
    body: [
      'You don’t need to have it all figured out to begin. Our approach is simple and human: we start where you are, get honest about what you want, and take it one steady step at a time.',
      'It’s less about pushing harder and more about seeing clearly — noticing the mindset and habits quietly shaping your days, then choosing the small, doable changes that add up to a life that feels like yours.',
    ],
    cta: { label: 'Book a free discovery call', href: '/book' },
  }),
  teamRow({
    heading: 'Meet your coaches',
    intro: 'Book with the coach whose focus fits you best — you’ll work with the same person throughout your journey.',
    members: [
      {
        name: 'Elena Ross',
        role: 'Life & transitions coach',
        image: url(IMG.elena),
        alt: 'Elena Ross, life & transitions coach',
        bio: 'Guides people through big life changes — careers, moves, new chapters — with warmth and a steady, mindset-first approach.',
      },
      {
        name: 'Marcus Bell',
        role: 'Confidence & habits coach',
        image: url(IMG.marcus),
        alt: 'Marcus Bell, confidence & habits coach',
        bio: 'Helps you build real confidence and habits that last, one practical, encouraging step at a time.',
      },
      {
        name: 'Priya Anand',
        role: 'Purpose & balance coach',
        image: url(IMG.priya),
        alt: 'Priya Anand, purpose & balance coach',
        bio: 'Specialises in purpose, work–life balance and reconnecting with what genuinely matters to you.',
      },
    ],
  }),
  testimonial({
    quote:
      'I came in feeling completely stuck and left with a plan and, honestly, hope. Six months on I’ve changed careers and I actually feel like myself again. Brightpath gave me the nudge and the belief I couldn’t find alone.',
    attribution: 'Dani M., client since 2025',
    surface: 'muted',
  }),
  bookingCta({
    title: 'The first step is a free conversation',
    sub: 'No commitment, no pressure — just 30 minutes to talk it through and see how coaching could help. Book a time that works for you.',
    cta: { label: 'Book a free discovery call', href: '/book' },
  }),
];

const BOOK_INTRO = [
  photoHero({
    image: url(IMG.approach),
    alt: 'A calm, sunlit corner with a notebook and a warm cup of tea',
    title: 'Book your session',
    sub: 'Start with a free discovery call, or choose the session that fits where you are. Pick your coach and see live availability below.',
    primary: { label: 'See sessions below', href: '/book' },
    overlay: 'darker',
    align: 'start',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.about),
    alt: 'Two people in relaxed conversation on a bright video call',
    heading: 'About Brightpath',
    body: [
      'Brightpath began with a simple belief: everyone deserves a caring, capable person in their corner when life asks them to change. Not a lecturer, not a guru — a coach who listens, believes in you, and helps you move forward.',
      'We work with people from every walk of life — those navigating transitions, rebuilding confidence, chasing more balance, or simply wanting to feel purposeful again. Wherever you’re starting from, you’re welcome here.',
    ],
    cta: { label: 'Book a free discovery call', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'What working with us feels like',
    items: [
      {
        title: 'We start with a conversation',
        body: 'Every journey opens with a real talk about where you are, what’s weighing on you and what you’d love to be different.',
      },
      {
        title: 'We go at your pace',
        body: 'No rigid programme to force you through. We meet you where you are and build something that fits your life and your goals.',
      },
      {
        title: 'You leave with more than words',
        body: 'Insight is lovely, but change comes from doing. You’ll always leave with a small, clear step you can actually take.',
      },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Get in touch',
    address: ['Brightpath Life Coaching', 'Virtual sessions worldwide', 'Based in Asheville, NC'],
    mapLocation: 'Asheville, NC',
    hours: [
      { day: 'Monday – Thursday', time: '9:00 – 7:00' },
      { day: 'Friday', time: '10:00 – 5:00' },
      { day: 'Saturday', time: '10:00 – 2:00' },
      { day: 'Sunday', time: 'Closed' },
    ],
  }),
  bookingCta({
    title: 'Ready to take the first step?',
    sub: 'Book your free discovery call online and see live availability — no phone tag, no pressure.',
    surface: 'muted',
    cta: { label: 'Book a free discovery call', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-lifecoach-wellness',
  name: 'Life Coach (Wellness)',
  summary:
    'A warm, encouraging site for a life & wellness coaching practice — a cream palette, a terracotta primary and a soft humanist serif, with hopeful photography carrying the page. Installs online booking from day one: a free discovery call plus real coaching sessions (life, mindset, confidence, balance, purpose), and three coaches you book by name as bookable resources with their own hours. Ships as "Brightpath Life Coaching".',
  tagline: 'A warm, uplifting template for life & wellness coaches — book online from day one.',
  industry: 'Life coaching',
  sortWeight: 11,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'Brightpath Life Coaching', tagline: 'Your next chapter, gently guided.' },
  theme: brightpath,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Brightpath Life Coaching — warm, judgment-free coaching',
      description:
        'Brightpath Life Coaching helps you navigate change with warm, certified coaching — life transitions, confidence, mindset, balance and purpose. Book a free discovery call online.',
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
