// sparx-nutrition-wellness — "Nourish Nutrition", a warm registered-dietitian practice.
//
// The caring, whole-health, NON-DIET nutrition practice: a soft-cream ground, a sage
// warm-green primary, a terracotta accent, and a warm humanist serif (Fraunces display
// over Inter body) with rounded corners. Evidence-based and judgment-free — weight
// management, gut health, intuitive eating, diabetes and heart health, family nutrition,
// in-person and virtual. Deliberately the WARM wellness sibling of the sports/performance
// nutrition template (that one is cool, kinetic, metric-driven) — same booking spine, a
// visibly different business, whose functional core is BOOKING A CONSULTATION.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @wizeworks/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-nutrition-wellness.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-nutrition-wellness/**" \
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
  hero: 'nutrition-wellness-hero',
  approach: 'nutrition-wellness-approach',
  hannah: 'nutrition-wellness-hannah',
  david: 'nutrition-wellness-david',
  sofia: 'nutrition-wellness-sofia',
} as const;

const PHOTO: Record<string, string> = {
  "nourish-hero": "https://images.unsplash.com/photo-1597362925123-77861d3fbac7?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8aGVhbHRoeSUyMGZvb2QlMjBmcmVzaCUyMHZlZ2V0YWJsZXN8ZW58MHwwfHx8MTc4NjM5NDI2Mnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "nourish-approach": "https://images.unsplash.com/photo-1675270360889-2c850358e364?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZGlldGl0aWFuJTIwY29uc3VsdGF0aW9ufGVufDB8MHx8fDE3ODYzOTQyNjV8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "nourish-hannah": "https://images.unsplash.com/photo-1675270690434-aa99f4871e8a?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjBudXRyaXRpb25pc3QlMjBwb3J0cmFpdHxlbnwwfDB8fHwxNzg2Mzk0MjY4fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "nourish-david": "https://images.unsplash.com/photo-1623366302587-b38b1ddaefd9?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZGlldGl0aWFuJTIwcG9ydHJhaXQlMjBtYW58ZW58MHwwfHx8MTc4NjM5NDI3MXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "nourish-sofia": "https://images.unsplash.com/photo-1659353888906-adb3e0041693?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjBoZWFsdGhjYXJlJTIwcG9ydHJhaXR8ZW58MHwwfHx8MTc4NjM4OTI5N3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
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
    url: src('nourish-hero'),
    alt: 'A bright wooden table of fresh vegetables, fruit and whole grains',
  },
  {
    id: IMG.approach,
    url: src('nourish-approach'),
    alt: 'A dietitian and client talking warmly over a cup of tea',
  },
  {
    id: IMG.hannah,
    url: src('nourish-hannah'),
    alt: 'Hannah Okafor, registered dietitian',
  },
  {
    id: IMG.david,
    url: src('nourish-david'),
    alt: 'David Alvarez, registered dietitian',
  },
  {
    id: IMG.sofia,
    url: src('nourish-sofia'),
    alt: 'Sofia Lindqvist, registered dietitian',
  },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-nutrition-wellness: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "nourish": soft-cream ground, sage primary, terracotta accent, warm serif ─
const nourish = defineTheme({
  name: 'nourish',
  type: { body: face('Inter', 'sans-serif'), head: face('Fraunces', 'serif') },
  shape: { selector: '0.875rem', field: '0.75rem', box: '1.25rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(97.5% 0.02 90)', // soft warm cream
      'oklch(94% 0.028 92)', // oat
      'oklch(88% 0.03 95)', // hairline
      'oklch(28% 0.03 75)', // warm deep ink
    ],
    roles: {
      primary: 'oklch(52% 0.09 148)', // sage warm-green
      secondary: 'oklch(36% 0.03 70)', // dark readable warm brown
      accent: 'oklch(64% 0.13 46)', // terracotta
      neutral: 'oklch(30% 0.025 72)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(24% 0.028 75)',
      'oklch(20% 0.024 75)',
      'oklch(16% 0.018 75)',
      'oklch(95% 0.02 90)',
    ],
    roles: {
      primary: 'oklch(72% 0.1 150)',
      secondary: 'oklch(78% 0.03 78)',
      accent: 'oklch(74% 0.12 48)',
      neutral: 'oklch(82% 0.024 78)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the booking spine (policies, dietitians + hours, the consult menu) ────
const hours = (days: number[], startMinute: number, endMinute: number) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

const SCHEDULING = {
  policies: [
    {
      handle: 'nutrition-standard',
      name: 'Standard booking',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [1440, 120],
      policyText:
        'Please give at least 24 hours’ notice to reschedule or cancel — life happens, and there’s no charge when you let us know in time. We send a reminder the day before and two hours ahead.',
    },
    {
      handle: 'nutrition-no-show',
      name: 'Session hold',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [2880, 1440, 120],
      policyText:
        'Booked consultations are time held just for you. Reschedule with 24 hours’ notice at no cost; a missed session or a same-day cancellation is billed as the full fee so your dietitian’s time is respected.',
    },
  ],
  resources: [
    {
      handle: 'hannah',
      name: 'Hannah Okafor',
      kind: 'staff',
      skillTags: ['weight', 'gut', 'general'],
      // Mon–Thu 9–5 + Tue/Thu evenings run to 8
      windows: [...hours([1, 3], 540, 1020), ...hours([2, 4], 540, 1200)],
    },
    {
      handle: 'david',
      name: 'David Alvarez',
      kind: 'staff',
      skillTags: ['diabetes', 'heart', 'general'],
      // Mon/Wed/Fri 8–4 + Wed evening to 8
      windows: [...hours([1, 5], 480, 960), ...hours([3], 480, 1200)],
    },
    {
      handle: 'sofia',
      name: 'Sofia Lindqvist',
      kind: 'staff',
      skillTags: ['intuitive', 'family', 'general'],
      // Tue–Fri 10–6 + Sat mornings 9–1
      windows: [...hours([2, 3, 4, 5], 600, 1080), ...hours([6], 540, 780)],
    },
  ],
  services: [
    {
      handle: 'free-discovery-call',
      name: 'Free discovery call',
      description:
        'A relaxed 20-minute call to hear what you’re hoping to change and match you with the right dietitian. No cost, no pressure.',
      durationMinutes: 20,
      priceCents: 0,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'dietitian', kind: 'staff', skillTags: ['general'], count: 1 },
      ],
      policyHandle: 'nutrition-standard',
    },
    {
      handle: 'initial-consultation',
      name: 'Initial consultation',
      description:
        'A thorough first session — your history, health goals and relationship with food — and a realistic, personal plan you leave with.',
      durationMinutes: 60,
      priceCents: 16500,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'dietitian', kind: 'staff', skillTags: ['general'], count: 1 },
      ],
      policyHandle: 'nutrition-no-show',
    },
    {
      handle: 'follow-up-session',
      name: 'Follow-up session',
      description:
        'A check-in between visits to review how things are going, celebrate wins and adjust the plan so it keeps fitting your life.',
      durationMinutes: 30,
      priceCents: 9000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'dietitian', kind: 'staff', skillTags: ['general'], count: 1 },
      ],
      policyHandle: 'nutrition-no-show',
    },
    {
      handle: 'gut-health-consult',
      name: 'Gut health consult',
      description:
        'Focused support for bloating, IBS and digestive comfort — evidence-based, food-first, and never one-size-fits-all.',
      durationMinutes: 50,
      priceCents: 15000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'dietitian', kind: 'staff', skillTags: ['gut'], count: 1 },
      ],
      policyHandle: 'nutrition-no-show',
    },
    {
      handle: 'weight-management-session',
      name: 'Weight management session',
      description:
        'A non-diet approach to weight and energy — steady, sustainable habits built around your body, not a crash plan.',
      durationMinutes: 50,
      priceCents: 15000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'dietitian', kind: 'staff', skillTags: ['general'], count: 1 },
      ],
      policyHandle: 'nutrition-no-show',
    },
    {
      handle: 'intuitive-eating-session',
      name: 'Intuitive eating session',
      description:
        'Rebuild trust with food and step off the diet cycle — gentle, judgment-free coaching toward eating that feels easy again.',
      durationMinutes: 50,
      priceCents: 15000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'dietitian', kind: 'staff', skillTags: ['general'], count: 1 },
      ],
      policyHandle: 'nutrition-no-show',
    },
    {
      handle: 'family-nutrition-consult',
      name: 'Family nutrition consult',
      description:
        'Practical, calm help feeding a family well — picky eaters, busy weeknights and real budgets, without the guilt.',
      durationMinutes: 45,
      priceCents: 14000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'dietitian', kind: 'staff', skillTags: ['general'], count: 1 },
      ],
      policyHandle: 'nutrition-no-show',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  photoHero({
    image: url(IMG.hero),
    alt: 'A bright wooden table of fresh vegetables, fruit and whole grains',
    title: 'Food that feels good again',
    sub: 'Work one-to-one with a registered dietitian on real, sustainable changes — weight, gut health, energy and your whole relationship with food. In person or by video, whenever suits you.',
    primary: { label: 'Book a consultation', href: '/book' },
    secondary: { label: 'Start with a free call', href: '/book' },
    overlay: 'soft',
  }),
  featureRow({
    heading: 'Care you can actually keep up',
    items: [
      {
        title: 'Registered dietitians',
        body: 'Every plan comes from a qualified, registered dietitian — real credentials and real science, translated into food you’ll genuinely eat.',
      },
      {
        title: 'Non-diet & judgment-free',
        body: 'No shame, no crash plans, no forbidden foods. We build steady habits around your life, your budget and your body — not against them.',
      },
      {
        title: 'Insurance often covers it',
        body: 'Many plans cover nutrition counseling, especially with a referral. We’ll help you check your benefits before your first visit.',
      },
      {
        title: 'In person & virtual',
        body: 'Meet us at the office or by secure video from your own kitchen — evenings and a Saturday morning included, so it fits your week.',
      },
    ],
  }),
  serviceMenu({
    heading: 'Ways we can work together',
    intro: 'Start with a free discovery call, then choose the consultation that fits. Full prices and live availability are on the booking page.',
    surface: 'muted',
    columns: 2,
    items: [
      {
        name: 'Free discovery call',
        priceCents: 0,
        durationMin: 20,
        desc: 'A no-cost call to match you with the right dietitian.',
      },
      {
        name: 'Initial consultation',
        priceCents: 16500,
        durationMin: 60,
        desc: 'A full first session and a personal plan you leave with.',
      },
      {
        name: 'Gut health consult',
        priceCents: 15000,
        durationMin: 50,
        desc: 'Food-first support for bloating, IBS and digestion.',
      },
      {
        name: 'Intuitive eating session',
        priceCents: 15000,
        durationMin: 50,
        desc: 'Gentle coaching to step off the diet cycle for good.',
      },
    ],
    cta: { label: 'See everything & book', href: '/book' },
  }),
  splitFeature({
    image: url(IMG.approach),
    alt: 'A dietitian and client talking warmly over a cup of tea',
    heading: 'Whole-health nutrition, not another diet',
    body: [
      'Diets ask you to shrink your life to fit a plan. We do the opposite — build the plan around your real days, your favourite foods and the health goals that matter to you.',
      'That means no food is off-limits and no number defines you. Just warm, evidence-based guidance that helps you feel steadier, more energised and more at ease at the table — for good, not for six weeks.',
    ],
    cta: { label: 'Book a consultation', href: '/book' },
  }),
  teamRow({
    heading: 'Meet your dietitians',
    intro: 'Book by name — you’ll see the same dietitian each visit, someone who gets to know you, your health and your story.',
    members: [
      {
        name: 'Hannah Okafor',
        role: 'Registered dietitian',
        image: url(IMG.hannah),
        alt: 'Hannah Okafor, registered dietitian',
        bio: 'Weight, gut health and everyday energy, with a warm, no-nonsense style. Hannah leads the practice.',
      },
      {
        name: 'David Alvarez',
        role: 'Registered dietitian',
        image: url(IMG.david),
        alt: 'David Alvarez, registered dietitian',
        bio: 'Diabetes and heart health — turning a diagnosis into calm, doable everyday choices.',
      },
      {
        name: 'Sofia Lindqvist',
        role: 'Registered dietitian',
        image: url(IMG.sofia),
        alt: 'Sofia Lindqvist, registered dietitian',
        bio: 'Intuitive eating and family nutrition, judgment-free — feeding yourself and your kids without the stress.',
      },
    ],
  }),
  testimonial({
    quote:
      'I came in expecting another diet and a list of foods to fear. Instead I got a plan that fits my actual life — and the first calm relationship with food I’ve had in years.',
    attribution: 'Rachel, client since 2024',
  }),
  bookingCta({
    title: 'Start with one small, kind step',
    sub: 'Book a free 20-minute discovery call — no cost, no commitment, just a conversation about what you’re hoping to change. It takes about a minute.',
    cta: { label: 'Book a consultation', href: '/book' },
  }),
];

const BOOK_INTRO = [
  photoHero({
    image: url(IMG.approach),
    alt: 'A dietitian and client talking warmly over a cup of tea',
    title: 'Book your consultation',
    sub: 'Choose a consultation to see live availability, then pick your dietitian and a time that works for you. New here? Start with the free discovery call.',
    primary: { label: 'See consultations below', href: '/book' },
    overlay: 'darker',
    align: 'start',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.hero),
    alt: 'A bright wooden table of fresh vegetables, fruit and whole grains',
    heading: 'About Nourish Nutrition',
    body: [
      'We started Nourish because so much of what people are told about food is loud, contradictory and unkind. Cutting out whole food groups, chasing the newest diet, feeling guilty for eating — none of it lasts, and none of it feels good.',
      'So we built a practice around the opposite: registered dietitians, real science, and warm, practical support that meets you exactly where you are. Whether it’s gut trouble, a new diagnosis, or just wanting to feel at ease with food again, our job is to make the next step feel doable.',
    ],
    cta: { label: 'Book a consultation', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'What we believe',
    items: [
      {
        title: 'All foods fit',
        body: 'No forbidden lists and no guilt. Lasting change comes from adding what helps and finding balance, not from cutting out everything you love.',
      },
      {
        title: 'Evidence over trends',
        body: 'Fads come and go; good science stays. Every recommendation is grounded in real nutrition research, not the latest headline or supplement.',
      },
      {
        title: 'Your goals, your pace',
        body: 'You set the direction and the speed. We’re here to guide, adjust and cheer you on — never to hand you a rigid plan and walk away.',
      },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Reach the practice',
    address: [
      'Nourish Nutrition',
      'In person & virtual · secure video sessions',
      '84 Maple Court, Suite 3 · Portland, OR 97209',
    ],
    mapLocation: '84 Maple Court, Portland, OR 97209',
    hours: [
      { day: 'Monday & Friday', time: '8:00 – 5:00' },
      { day: 'Tuesday – Thursday', time: '9:00 – 8:00 (evenings)' },
      { day: 'Saturday', time: '9:00 – 1:00' },
      { day: 'Sunday', time: 'Closed' },
    ],
  }),
  bookingCta({
    title: 'Rather book than email?',
    sub: 'See live availability and reserve a free discovery call online — no phone tag, no waiting.',
    surface: 'muted',
    cta: { label: 'Book a consultation', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-nutrition-wellness',
  name: 'Nutrition (Wellness)',
  summary:
    'A warm, non-diet nutrition site — a soft-cream palette, a sage primary and a terracotta accent, with fresh-food photography carrying the page. Installs a working online booking flow: a free discovery call plus initial, gut-health, weight, intuitive-eating and family consults, three registered dietitians you book by name with evening and Saturday hours, and a no-show hold policy. Ships as "Nourish Nutrition", a caring whole-health practice.',
  tagline: 'A warm, non-diet template for nutrition practices — book consults from day one.',
  industry: 'Nutrition',
  sortWeight: 20,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'Nourish Nutrition', tagline: 'Whole-health nutrition, kindly done.' },
  theme: nourish,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Nourish Nutrition — warm, non-diet nutrition counseling',
      description:
        'Nourish Nutrition is a whole-health dietitian practice — one-to-one nutrition counseling for weight, gut health, intuitive eating and family nutrition, in person or by video. Book a free discovery call.',
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
