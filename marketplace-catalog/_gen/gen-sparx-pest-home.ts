// sparx-pest-home — "ShieldGuard Pest Control", a friendly residential pest-control company.
//
// The dependable, everyday, protection-plan pest company: general pest, ants, roaches,
// rodents, termites, mosquitoes — and recurring plans that keep a home protected all year.
// Its whole personality is RELIABLE and REASSURING — a confident teal-blue primary paired
// with a warm green accent on a clean near-white ground — and its promise is "your home,
// pest-free, guaranteed." Deliberately the friendly, dependable sibling: there is a separate
// eco/natural pest-control template (a leaves-and-earth, chemical-free angle), so this one
// leads with reliability, licensed people and a written guarantee, not a green manifesto.
// Same booking spine as the rest of the service family — a real menu of visits, dispatchable
// technicians with their own hours, a recurring-plan policy — a business that FUNCTIONS on
// day one.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @wizeworks/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-pest-home.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-pest-home/**" \
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
  hero: 'pest-home-hero',
  plan: 'pest-home-plan',
  marcus: 'pest-home-marcus',
  priya: 'pest-home-priya',
  devon: 'pest-home-devon',
} as const;

const PHOTO: Record<string, string> = {
  "shieldguard-hero": "https://images.unsplash.com/photo-1709787627975-9cb37bbeca60?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8aGFwcHklMjBmYW1pbHklMjBob21lJTIwZXh0ZXJpb3J8ZW58MHwwfHx8MTc4NjM5Mzc1Mnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "shieldguard-plan": "https://images.unsplash.com/photo-1581578017093-cd30fce4eeb7?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGVzdCUyMGNvbnRyb2wlMjB0ZWNobmljaWFufGVufDB8MHx8fDE3ODYzOTM3NTV8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "shieldguard-marcus": "https://images.unsplash.com/photo-1764014353079-08ece464a226?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dGVjaG5pY2lhbiUyMHBvcnRyYWl0JTIwbWFufGVufDB8MHx8fDE3ODYzODgyNDl8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "shieldguard-priya": "https://images.unsplash.com/photo-1615464670798-6e92fafa2a89?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjB3b3JrZXIlMjBwb3J0cmFpdHxlbnwwfDB8fHwxNzg2Mzg4MjQwfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "shieldguard-devon": "https://images.unsplash.com/photo-1759521296144-fe6f2d2dc769?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29ya2VyJTIwcG9ydHJhaXQlMjB1bmlmb3JtfGVufDB8MHx8fDE3ODYzODkyNjJ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
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
    url: src('shieldguard-hero'),
    alt: 'A tidy, sunlit family home with a well-kept front yard',
  },
  {
    id: IMG.plan,
    url: src('shieldguard-plan'),
    alt: 'A uniformed technician treating the exterior foundation of a home',
  },
  { id: IMG.marcus, url: src('shieldguard-marcus'), alt: 'Marcus Reyes, lead pest technician' },
  { id: IMG.priya, url: src('shieldguard-priya'), alt: 'Priya Nair, termite & inspection specialist' },
  { id: IMG.devon, url: src('shieldguard-devon'), alt: 'Devon Clarke, recurring-service technician' },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-pest-home: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "shieldguard": reliable + reassuring — confident teal-blue primary, warm green
//    accent, clean near-white ground, dark-slate secondary (readable on the light ground) ──
const shieldguard = defineTheme({
  name: 'shieldguard',
  type: { body: face('Inter', 'sans-serif'), head: face('Outfit', 'sans-serif') },
  shape: { selector: '0.75rem', field: '0.75rem', box: '1rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(98% 0.006 210)', // near white
      'oklch(95% 0.01 205)', // cool haze
      'oklch(90% 0.014 200)', // hairline
      'oklch(26% 0.03 235)', // dark slate ink
    ],
    roles: {
      primary: 'oklch(58% 0.10 210)', // confident teal-blue
      secondary: 'oklch(35% 0.03 235)', // dark slate
      accent: 'oklch(64% 0.14 150)', // warm green
      neutral: 'oklch(30% 0.025 235)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(23% 0.02 235)',
      'oklch(19% 0.018 235)',
      'oklch(15% 0.015 235)',
      'oklch(95% 0.008 210)',
    ],
    roles: {
      primary: 'oklch(72% 0.11 205)',
      secondary: 'oklch(80% 0.02 225)',
      accent: 'oklch(74% 0.13 150)',
      neutral: 'oklch(82% 0.02 225)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the booking spine (policies, technicians + hours, the visit menu) ─────
const hours = (days: number[], startMinute: number, endMinute: number) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

const SCHEDULING = {
  policies: [
    {
      handle: 'shieldguard-standard',
      name: 'Standard visit',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [1440, 120],
      policyText:
        'Give us a day’s notice if you need to move your visit and we’ll happily reschedule. We text a reminder the day before and two hours ahead, and your technician calls when they’re on the way.',
    },
    {
      handle: 'shieldguard-plan',
      name: 'Protection plan',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [2880, 1440, 120],
      policyText:
        'Protection-plan members get their recurring visits scheduled automatically, priority booking when something comes up between visits, and our re-treat-free guarantee. Change or skip a visit up to 24 hours ahead at no charge.',
    },
  ],
  resources: [
    {
      handle: 'marcus',
      name: 'Marcus Reyes',
      kind: 'staff',
      skillTags: ['general', 'ants', 'rodents'],
      windows: hours([1, 2, 3, 4, 5], 450, 1050), // Mon–Fri 7:30–5:30
    },
    {
      handle: 'priya',
      name: 'Priya Nair',
      kind: 'staff',
      skillTags: ['termites', 'general', 'inspection'],
      windows: hours([1, 2, 3, 4, 5], 480, 1020), // Mon–Fri 8–5
    },
    {
      handle: 'devon',
      name: 'Devon Clarke',
      kind: 'staff',
      skillTags: ['general', 'recurring', 'rodents'],
      windows: hours([1, 2, 3, 4, 5, 6], 420, 1080), // Mon–Sat 7–6
    },
  ],
  services: [
    {
      handle: 'free-inspection',
      name: 'Free inspection',
      description:
        'A friendly, no-pressure home visit to check inside and out, find where pests are getting in, and give you a plain-language plan and quote — completely free.',
      durationMinutes: 45,
      priceCents: 0,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'technician', kind: 'staff', skillTags: ['general'], count: 1 },
      ],
      policyHandle: 'shieldguard-standard',
    },
    {
      handle: 'general-pest-treatment',
      name: 'General pest treatment',
      description:
        'A thorough interior-and-exterior treatment for the everyday intruders — spiders, silverfish, earwigs and the rest — with a barrier that keeps working for weeks.',
      durationMinutes: 60,
      priceCents: 12900,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'technician', kind: 'staff', skillTags: ['general'], count: 1 },
      ],
      policyHandle: 'shieldguard-standard',
    },
    {
      handle: 'ant-roach-treatment',
      name: 'Ant & roach treatment',
      description:
        'A targeted knock-down of an active ant or cockroach problem — baiting the trails and colonies at the source, not just the ones you can see on the counter.',
      durationMinutes: 60,
      priceCents: 14900,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'technician', kind: 'staff', skillTags: ['ants'], count: 1 },
      ],
      policyHandle: 'shieldguard-standard',
    },
    {
      handle: 'rodent-control-visit',
      name: 'Rodent control visit',
      description:
        'Mice or rats? A tech seals up entry points, sets a discreet control program, and comes back to check it — so the problem ends instead of moving room to room.',
      durationMinutes: 75,
      priceCents: 18900,
      bufferAfterMin: 15,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'technician', kind: 'staff', skillTags: ['rodents'], count: 1 },
      ],
      policyHandle: 'shieldguard-standard',
    },
    {
      handle: 'termite-inspection',
      name: 'Termite inspection',
      description:
        'A detailed, WDO-style inspection for termites and wood-destroying pests — with photos, an honest assessment of any risk, and a treatment plan only if you actually need one.',
      durationMinutes: 90,
      priceCents: 0,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'technician', kind: 'staff', skillTags: ['termites'], count: 1 },
      ],
      policyHandle: 'shieldguard-standard',
    },
    {
      handle: 'mosquito-treatment',
      name: 'Mosquito treatment',
      description:
        'A yard treatment that knocks down biting mosquitoes and treats the shady, standing-water spots they breed in — so the backyard is usable again all season.',
      durationMinutes: 45,
      priceCents: 9900,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'technician', kind: 'staff', skillTags: ['general'], count: 1 },
      ],
      policyHandle: 'shieldguard-standard',
    },
    {
      handle: 'recurring-plan-setup',
      name: 'Protection plan setup',
      description:
        'Set up your year-round Shield Plan — a first full treatment plus scheduled seasonal visits, priority service between them, and our re-treat-free guarantee.',
      durationMinutes: 60,
      priceCents: 8900,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'technician', kind: 'staff', skillTags: ['recurring'], count: 1 },
      ],
      policyHandle: 'shieldguard-plan',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  photoHero({
    image: url(IMG.hero),
    alt: 'A tidy, sunlit family home with a well-kept front yard',
    title: 'Your home, pest-free — guaranteed',
    sub: 'Reliable, friendly pest control for the whole year — general pests, ants, roaches, rodents and termites, handled by licensed local technicians who show up when they say they will.',
    primary: { label: 'Book a free inspection', href: '/book' },
    secondary: { label: 'See what we do', href: '/book' },
    overlay: 'dark',
  }),
  featureRow({
    items: [
      {
        title: 'Licensed local technicians',
        body: 'Every technician is state-licensed, background-checked and trained on today’s pests and treatments — and tidy, friendly and respectful of your home.',
      },
      {
        title: 'Satisfaction guaranteed',
        body: 'If pests come back between visits, so do we — at no charge. That’s the whole point of a plan, and it’s in writing.',
      },
      {
        title: 'Recurring protection plans',
        body: 'A simple year-round plan keeps your home protected season after season, with scheduled visits and priority service whenever you need it.',
      },
      {
        title: 'Safe & effective',
        body: 'Family- and pet-conscious products applied by people who know exactly where and how much — real results without dousing your home.',
      },
    ],
  }),
  serviceMenu({
    heading: 'Book a visit',
    intro: 'The visits we’re asked for most. Pick one to see live openings and choose a time that works for you.',
    surface: 'muted',
    columns: 2,
    items: [
      {
        name: 'Free inspection',
        priceCents: 0,
        durationMin: 45,
        desc: 'We find the problem and give you an honest plan — free.',
      },
      {
        name: 'General pest treatment',
        priceCents: 12900,
        durationMin: 60,
        desc: 'Interior and exterior, with a barrier that keeps working.',
      },
      {
        name: 'Rodent control visit',
        priceCents: 18900,
        durationMin: 75,
        desc: 'Seal the entry points and end the problem for good.',
      },
      {
        name: 'Termite inspection',
        priceCents: 0,
        durationMin: 90,
        desc: 'A detailed check with photos and an honest assessment.',
      },
    ],
    cta: { label: 'See every visit & book', href: '/book' },
  }),
  splitFeature({
    image: url(IMG.plan),
    alt: 'A uniformed technician treating the exterior foundation of a home',
    heading: 'Protection that never takes a season off',
    body: [
      'Pests don’t show up on a schedule, and a one-time spray only buys a few weeks. Ants come back in spring, mosquitoes in summer, rodents when it turns cold — a home stays protected only when someone’s watching it all year.',
      'Our Shield Plan members get scheduled seasonal visits, priority service the moment something turns up between them, and our re-treat-free guarantee — so your home stays protected without you having to think about it.',
    ],
    cta: { label: 'Start a protection plan', href: '/book' },
  }),
  teamRow({
    heading: 'The people who’ll come to your door',
    intro: 'Real technicians from right here — friendly, tidy, and happy to explain exactly what they find.',
    members: [
      {
        name: 'Marcus Reyes',
        role: 'Lead pest technician',
        image: url(IMG.marcus),
        alt: 'Marcus Reyes, lead pest technician',
        bio: 'Twelve years on ants, roaches and rodents. Marcus is the one who finds the entry point everyone else missed.',
      },
      {
        name: 'Priya Nair',
        role: 'Termite & inspection specialist',
        image: url(IMG.priya),
        alt: 'Priya Nair, termite & inspection specialist',
        bio: 'Handles termite and wood-destroying-pest inspections, and will only ever recommend treatment you actually need.',
      },
      {
        name: 'Devon Clarke',
        role: 'Recurring-service technician',
        image: url(IMG.devon),
        alt: 'Devon Clarke, recurring-service technician',
        bio: 'The friendly face on your seasonal visits — knows every home on his route and what keeps each one protected.',
      },
    ],
  }),
  testimonial({
    quote: 'We had ants marching across the kitchen every spring. ShieldGuard came out, found where they were getting in, and put us on a plan. Two years pest-free now, and the same tech every visit. Worth every penny.',
    attribution: 'The Delgado family, plan members since 2023',
  }),
  bookingCta({
    title: 'Let’s get your home protected',
    sub: 'Start with a free inspection, pick a time that fits your day, and we’ll take it from there. It takes about a minute.',
    cta: { label: 'Book a free inspection', href: '/book' },
  }),
];

const BOOK_INTRO = [
  photoHero({
    image: url(IMG.plan),
    alt: 'A uniformed technician treating the exterior foundation of a home',
    title: 'Book your visit',
    sub: 'Choose a visit to see prices and live openings, then pick a time that works — you’ll get a confirmation and a reminder before we arrive.',
    primary: { label: 'See visits below', href: '/book' },
    overlay: 'darker',
    align: 'start',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.hero),
    alt: 'A tidy, sunlit family home with a well-kept front yard',
    heading: 'About ShieldGuard Pest Control',
    body: [
      'We started ShieldGuard because keeping pests out of your home shouldn’t come with a hard sell, a mystery invoice, or a stranger you never see again. A pest-free home is a basic kind of peace of mind — and it should be handled by people who treat your home the way they’d treat their own.',
      'So that’s how we run it: licensed technicians, upfront prices, tidy work, and an honest read on what your home actually needs. Your home, pest-free, guaranteed — and the same friendly face on every visit.',
    ],
    cta: { label: 'Book a free inspection', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'How we work',
    items: [
      {
        title: 'We inspect first',
        body: 'Every job starts with a real look inside and out to find where pests are getting in — because treating the symptom without the source just moves the problem around.',
      },
      {
        title: 'We explain before we treat',
        body: 'You’ll always know what we found, what your options are, and what each one costs before any work starts. No pressure, no upsell — just an honest recommendation.',
      },
      {
        title: 'We stand behind it',
        body: 'Our plans are backed by a re-treat-free guarantee, and a real person answers the phone when you call. If pests come back, so do we — at no charge.',
      },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Reach the ShieldGuard team',
    address: ['ShieldGuard Pest Control', '2200 Cypress Hollow Road', 'Cedar Falls, TX 75104'],
    mapLocation: '2200 Cypress Hollow Road, Cedar Falls, TX 75104',
    hours: [
      { day: 'Monday – Friday', time: '7:30 – 5:30' },
      { day: 'Saturday', time: '8:00 – 2:00 (service visits)' },
      { day: 'Sunday', time: 'Closed' },
      { day: 'Plan members', time: 'Priority scheduling anytime' },
    ],
  }),
  bookingCta({
    title: 'Rather book than call?',
    sub: 'See live openings and reserve your free inspection online — pick a time, get a confirmation, done.',
    surface: 'muted',
    cta: { label: 'Book a free inspection', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-pest-home',
  name: 'Pest Control (Home)',
  summary:
    'A friendly residential pest-control site built on a reliable teal-and-green palette over a clean near-white ground. Installs a working booking flow: free inspections plus general, ant/roach, rodent, termite and mosquito treatments and recurring protection plans, three licensed technicians dispatched by skill with their own hours, and a plan policy. Ships as "ShieldGuard Pest Control".',
  tagline: 'A reliable, reassuring template for pest-control companies — book inspections from day one.',
  industry: 'Pest control',
  sortWeight: 28,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'ShieldGuard Pest Control', tagline: 'Your home, pest-free, guaranteed.' },
  theme: shieldguard,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'ShieldGuard Pest Control — reliable, guaranteed protection',
      description:
        'ShieldGuard Pest Control keeps your home pest-free all year — free inspections, general, rodent and termite treatments, and recurring protection plans from licensed local techs. Book online.',
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
