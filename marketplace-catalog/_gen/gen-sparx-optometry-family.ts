// sparx-optometry-family — "Clearview Eye Care", a friendly FAMILY optometry practice.
//
// The warm, welcoming, all-ages eye-care practice — "clear vision for the whole family."
// It leads with a bright, friendly optical setting and moves through reassuring beats:
// comprehensive eye exams, kids' vision, contacts, dry-eye help, medical eye visits and
// everyday glasses. Deliberately the WARM sibling — there is a separate modern boutique
// optical template, so this one is the friendly, all-ages, welcoming one, warm-white and
// rounded rather than sharp and editorial. A different business on the same booking spine
// as the dental practices and the salons.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-optometry-family.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-optometry-family/**" \
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
  hero: 'optometry-family-hero',
  interior: 'optometry-family-interior',
  elena: 'optometry-family-elena',
  marcus: 'optometry-family-marcus',
  nadia: 'optometry-family-nadia',
  kids: 'optometry-family-kids',
} as const;

// A swap point: fill an entry to hot-link a specific photograph; anything unlisted falls
// back to a deterministic seeded placeholder, so every asset always resolves to a 200.
const PHOTO: Record<string, string> = {
  "clearview-hero": "https://images.unsplash.com/photo-1517948430535-1e2469d314fe?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZXllJTIwZXhhbSUyMG9wdG9tZXRyeXxlbnwwfDB8fHwxNzg2MzkyMTE2fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "clearview-interior": "https://images.unsplash.com/photo-1615468822882-4828d2602857?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8b3B0aWNhbCUyMHNob3AlMjBleWVnbGFzc2VzfGVufDB8MHx8fDE3ODYzOTIxMTh8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "clearview-elena": "https://images.unsplash.com/photo-1757386320806-e3f03c9f41e8?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjBvcHRvbWV0cmlzdCUyMHBvcnRyYWl0fGVufDB8MHx8fDE3ODYzOTIxMjF8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "clearview-marcus": "https://images.unsplash.com/photo-1568602471122-7832951cc4c5?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8b3B0b21ldHJpc3QlMjBwb3J0cmFpdCUyMG1hbnxlbnwwfDB8fHwxNzg2MzkyMTI0fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "clearview-nadia": "https://images.unsplash.com/photo-1610013598025-8e6562cefc4e?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8b3B0aWNpYW4lMjBwb3J0cmFpdCUyMHdvbWFufGVufDB8MHx8fDE3ODYzOTIxMjd8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "clearview-kids": "https://images.unsplash.com/photo-1593194777536-e155e6d100b2?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2hpbGQlMjBnbGFzc2VzJTIwZXllJTIwZXhhbXxlbnwwfDB8fHwxNzg2MzkyMTMwfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (seed: string): string =>
  PHOTO[seed] ?? `https://picsum.photos/seed/${seed}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}
const ASSETS: Asset[] = [
  { id: IMG.hero, url: src('clearview-hero'), alt: 'A bright, friendly optical shop with big windows and rows of glasses on warm-lit shelves' },
  { id: IMG.interior, url: src('clearview-interior'), alt: 'A calm, welcoming eye-care exam room with a phoropter and soft daylight' },
  { id: IMG.elena, url: src('clearview-elena'), alt: 'Dr. Elena Reyes, optometrist, smiling warmly' },
  { id: IMG.marcus, url: src('clearview-marcus'), alt: 'Dr. Marcus Bell, optometrist, in the exam room' },
  { id: IMG.nadia, url: src('clearview-nadia'), alt: 'Nadia Okafor, licensed optician, helping choose frames' },
  { id: IMG.kids, url: src('clearview-kids'), alt: 'A young child trying on new glasses and grinning' },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-optometry-family: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "clearview": warm-white ground, clear teal primary, warm coral accent ─────
const clearview = defineTheme({
  name: 'clearview',
  type: { body: face('Inter', 'sans-serif'), head: face('Outfit', 'sans-serif') },
  shape: { selector: '0.75rem', field: '0.625rem', box: '1rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(98% 0.008 200)', // warm white with the faintest clear-blue cast
      'oklch(95% 0.016 200)', // soft sky-tinted panel
      'oklch(90% 0.022 205)', // gentle hairline
      'oklch(27% 0.03 245)', // dark slate ink
    ],
    roles: {
      primary: 'oklch(60% 0.12 205)', // clear, friendly teal
      secondary: 'oklch(37% 0.03 245)', // dark slate — readable for micro-labels on light
      accent: 'oklch(73% 0.13 45)', // warm coral / amber
      neutral: 'oklch(29% 0.02 245)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(23% 0.02 245)',
      'oklch(19% 0.018 245)',
      'oklch(15% 0.015 245)',
      'oklch(95% 0.008 200)',
    ],
    roles: {
      primary: 'oklch(74% 0.11 205)', // teal, lifted for a dark ground
      secondary: 'oklch(80% 0.02 220)',
      accent: 'oklch(77% 0.12 45)',
      neutral: 'oklch(82% 0.015 220)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the booking spine (policies, optometrists + optician + exam rooms) ────
const hours = (days: number[], startMinute: number, endMinute: number) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

// The exam rooms are open through the whole business week; a provider's own windows are
// what actually constrain a bookable slot. Every eye exam needs a provider AND a room.
const OPEN_WEEK = [...hours([1, 2, 3, 4, 5], 540, 1080), ...hours([6], 540, 900)]; // Mon–Fri 9–6, Sat 9–3

const SCHEDULING = {
  policies: [
    {
      handle: 'optometry-standard',
      name: 'Standard booking',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [1440, 120],
      policyText:
        'Please give us at least 24 hours’ notice if you need to change or cancel — it lets us offer the time to another family. We’ll text and email a friendly reminder the day before and two hours ahead.',
    },
    {
      handle: 'optometry-no-show',
      name: 'Reserved-chair hold',
      depositType: 'card_hold',
      cancellationWindowHours: 48,
      reminderOffsetsMin: [2880, 1440, 120],
      policyText:
        'Longer visits reserve an exam room and a doctor just for you, so we hold a card on file — nothing is charged unless the appointment is missed without 48 hours’ notice. Reschedule in time and the hold simply releases.',
    },
  ],
  resources: [
    {
      handle: 'dr-reyes',
      name: 'Dr. Elena Reyes',
      kind: 'staff',
      skillTags: ['exam', 'contacts', 'medical'],
      windows: hours([1, 2, 3, 4, 5], 540, 1020), // Mon–Fri 9–5
    },
    {
      handle: 'dr-bell',
      name: 'Dr. Marcus Bell',
      kind: 'staff',
      skillTags: ['exam', 'kids', 'dry-eye'],
      windows: [...hours([2, 3, 4, 5], 600, 1080), ...hours([6], 540, 900)], // Tue–Fri 10–6, Sat 9–3
    },
    {
      handle: 'nadia',
      name: 'Nadia Okafor',
      kind: 'staff',
      skillTags: ['styling', 'fitting'],
      windows: [...hours([1, 2, 3, 4, 5], 540, 1080), ...hours([6], 540, 900)], // Mon–Fri 9–6, Sat 9–3
    },
    {
      handle: 'exam-room-1',
      name: 'Exam Room 1',
      kind: 'space',
      skillTags: ['exam-room'],
      windows: OPEN_WEEK,
    },
    {
      handle: 'exam-room-2',
      name: 'Exam Room 2',
      kind: 'space',
      skillTags: ['exam-room'],
      windows: OPEN_WEEK,
    },
  ],
  services: [
    {
      handle: 'comprehensive-eye-exam',
      name: 'Comprehensive eye exam',
      description:
        'A thorough, unhurried check of your vision and eye health — sharpness, prescription, pressure and a look at the health of your eyes, with plenty of time for questions. The right first step for anyone new to us, at any age.',
      durationMinutes: 40,
      priceCents: 12900,
      bufferAfterMin: 10,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'provider', kind: 'staff', skillTags: ['exam'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['exam-room'], count: 1 },
      ],
      policyHandle: 'optometry-standard',
    },
    {
      handle: 'contact-lens-exam',
      name: 'Contact lens exam & fitting',
      description:
        'Everything a comprehensive exam covers, plus a proper contact-lens fitting — measurements, a trial pair and a hands-on lesson if you’re new to lenses. We’ll find the fit that feels comfortable all day.',
      durationMinutes: 50,
      priceCents: 15900,
      bufferAfterMin: 10,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'provider', kind: 'staff', skillTags: ['contacts'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['exam-room'], count: 1 },
      ],
      policyHandle: 'optometry-standard',
    },
    {
      handle: 'kids-eye-exam',
      name: 'Kids’ eye exam',
      description:
        'A friendly, playful eye check made just for little ones — no reading required for the youngest, lots of encouragement, and gentle screening for the vision problems that matter most as kids grow. First visits are our favourite.',
      durationMinutes: 30,
      priceCents: 9900,
      bufferAfterMin: 10,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'provider', kind: 'staff', skillTags: ['kids'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['exam-room'], count: 1 },
      ],
      policyHandle: 'optometry-standard',
    },
    {
      handle: 'dry-eye-consult',
      name: 'Dry-eye consultation',
      description:
        'Gritty, tired, watery or stinging eyes? Sit down with one of our doctors to find out why and what actually helps. We’ll examine your tear film, talk through simple options, and build a plan to get you comfortable again.',
      durationMinutes: 30,
      priceCents: 8900,
      bufferAfterMin: 10,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'provider', kind: 'staff', skillTags: ['dry-eye'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['exam-room'], count: 1 },
      ],
      policyHandle: 'optometry-standard',
    },
    {
      handle: 'medical-eye-visit',
      name: 'Medical eye visit',
      description:
        'Red, painful, or suddenly blurry? Got something in your eye, or an infection that won’t settle? Request a focused medical visit and we’ll examine what’s going on, ease it, and sort out the next step — often the same day.',
      durationMinutes: 30,
      priceCents: 11900,
      bufferAfterMin: 10,
      assignmentStrategy: 'any_available',
      requiresApproval: true,
      resourceRequirements: [
        { role: 'provider', kind: 'staff', skillTags: ['medical'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['exam-room'], count: 1 },
      ],
      policyHandle: 'optometry-no-show',
    },
    {
      handle: 'frame-styling',
      name: 'Frame styling session',
      description:
        'Bring your prescription (or your last pair) and let our optician help you find frames you’ll love — shapes that suit your face, lenses that suit your day, and honest advice on what’s worth it. No exam needed, and it’s free.',
      durationMinutes: 30,
      priceCents: 0,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'optician', kind: 'staff', skillTags: ['styling'], count: 1 },
      ],
      policyHandle: 'optometry-standard',
    },
    {
      handle: 'annual-checkup',
      name: 'Annual eye checkup',
      description:
        'Your regular yearly visit — a quick, friendly update of your prescription and a health check to keep everything on track. The easy way to stay ahead of changes before they become a problem.',
      durationMinutes: 30,
      priceCents: 10900,
      bufferAfterMin: 10,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'provider', kind: 'staff', skillTags: ['exam'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['exam-room'], count: 1 },
      ],
      policyHandle: 'optometry-standard',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  photoHero({
    image: url(IMG.hero),
    alt: 'A bright, friendly optical shop with big windows and rows of glasses on warm-lit shelves',
    title: 'Clear vision for the whole family',
    sub: 'Warm, unhurried eye care for every age — comprehensive exams, kids’ vision, contacts, dry-eye help and a wall of frames to love. New patients always welcome.',
    primary: { label: 'Book an eye exam', href: '/book' },
    secondary: { label: 'See appointments', href: '/book' },
    overlay: 'soft',
  }),
  featureRow({
    items: [
      {
        title: 'Thorough, unhurried exams',
        body: 'We take the time to check your vision and the health of your eyes properly, explain what we see in plain language, and never rush you out the door.',
      },
      {
        title: 'Most insurance accepted',
        body: 'We work with most major vision and medical plans and file the claim for you, so there are no surprises. No insurance? Ask about our simple in-house plan.',
      },
      {
        title: 'Kids genuinely welcome',
        body: 'From a toddler’s first check to a teenager’s new contacts, we make eye exams playful and easy — gentle doctors, no scary words, plenty of high-fives.',
      },
      {
        title: 'A huge frame selection',
        body: 'Hundreds of frames for every face and budget, and an optician who’ll happily help you find the pair you actually want to wear every day.',
      },
    ],
  }),
  serviceMenu({
    heading: 'Appointments',
    intro: 'A few of the visits we see most. Full prices and live availability are on the booking page — and frame styling is always free.',
    surface: 'muted',
    columns: 2,
    items: [
      { name: 'Comprehensive eye exam', priceCents: 12900, durationMin: 40, desc: 'A full check of your vision and eye health.' },
      { name: 'Contact lens exam & fitting', priceCents: 15900, durationMin: 50, desc: 'An exam plus a proper contact-lens fitting.' },
      { name: 'Kids’ eye exam', priceCents: 9900, durationMin: 30, desc: 'A friendly, playful check made for little ones.' },
      { name: 'Dry-eye consultation', priceCents: 8900, durationMin: 30, desc: 'Find out why your eyes bother you — and fix it.' },
      { name: 'Medical eye visit', priceCents: 11900, durationMin: 30, desc: 'Red, painful or blurry? Often seen the same day.' },
      { name: 'Frame styling session', priceCents: 0, durationMin: 30, desc: 'Free, friendly help choosing frames you’ll love.' },
    ],
    cta: { label: 'See everything & book', href: '/book' },
  }),
  splitFeature({
    image: url(IMG.interior),
    alt: 'A calm, welcoming eye-care exam room with a phoropter and soft daylight',
    heading: 'Family eye care, the warm way',
    body: [
      'Clearview is a neighbourhood practice built for real families — the kind of place where the whole household can be seen in one trip, where the optician remembers your kids’ names, and where nobody is ever made to feel rushed or upsold.',
      'We keep things simple and honest: clear prices, gentle exams, and only the lenses and care you actually need. Come in for a check-up, a new prescription, or just to browse frames — and leave seeing better and feeling looked after.',
    ],
    cta: { label: 'Book your visit', href: '/book' },
  }),
  teamRow({
    heading: 'Meet the team',
    intro: 'Book by name — you’ll see friendly, familiar faces every visit.',
    members: [
      { name: 'Dr. Elena Reyes', role: 'Optometrist', image: url(IMG.elena), alt: 'Dr. Elena Reyes, optometrist, smiling warmly', bio: 'Comprehensive exams, contacts and medical eye care — with a gentle, patient way about her. Elena founded the practice.' },
      { name: 'Dr. Marcus Bell', role: 'Optometrist · kids & dry-eye', image: url(IMG.marcus), alt: 'Dr. Marcus Bell, optometrist, in the exam room', bio: 'A favourite with little ones and anyone battling dry, tired eyes — Marcus makes first visits fun and fear-free.' },
      { name: 'Nadia Okafor', role: 'Licensed optician', image: url(IMG.nadia), alt: 'Nadia Okafor, licensed optician, helping choose frames', bio: 'The eye for frames — Nadia helps you find the pair that fits your face, your lenses and your life.' },
    ],
  }),
  testimonial({
    quote: 'My kids actually look forward to the eye doctor now — and I finally found frames I love instead of settling. The whole team is warm, patient and never pushy. We’ve moved the whole family here.',
    attribution: 'Bianca, mum of two & patient since 2022',
  }),
  bookingCta({
    title: 'New patients always welcome',
    sub: 'Pick a visit, choose your doctor and see live times. It takes about a minute — and we’ll take it from there.',
    cta: { label: 'Book an eye exam', href: '/book' },
  }),
];

const BOOK_INTRO = [
  photoHero({
    image: url(IMG.kids),
    alt: 'A young child trying on new glasses and grinning',
    title: 'Book your appointment',
    sub: 'Choose a visit to see prices and live availability, then pick your optometrist and a time that suits the family.',
    primary: { label: 'See appointments below', href: '/book' },
    overlay: 'darker',
    align: 'start',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.hero),
    alt: 'A bright, friendly optical shop with big windows and rows of glasses on warm-lit shelves',
    heading: 'About Clearview Eye Care',
    body: [
      'We opened Clearview to be the kind of eye doctor we’d want for our own families — warm, honest and genuinely unhurried. Somewhere every age feels welcome, from a child’s first exam to a grandparent’s yearly check.',
      'No upselling, no lectures, no confusing jargon. Just thorough exams, clear explanations, and a friendly team that treats you like a neighbour, because you probably are one.',
    ],
    cta: { label: 'Book a visit', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'How we care for your eyes',
    items: [
      { title: 'We listen first', body: 'Every visit starts with a real conversation about your eyes, your day and your budget — so the plan fits your life, not a sales target.' },
      { title: 'Honest, clear pricing', body: 'We’ll always tell you the cost before we start, file your insurance for you, and never push lenses or extras you don’t need.' },
      { title: 'Gentle for every age', body: 'Wriggly toddlers, nervous first-timers, busy teens and everyone after — we know how to make each one comfortable and glad they came.' },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Visit the practice',
    address: ['Clearview Eye Care', '318 Cedar Park Avenue', 'Portland, OR 97214'],
    mapLocation: '318 Cedar Park Avenue, Portland, OR 97214',
    hours: [
      { day: 'Monday – Friday', time: '9:00 – 6:00' },
      { day: 'Saturday', time: '9:00 – 3:00' },
      { day: 'Sunday', time: 'Closed' },
    ],
  }),
  bookingCta({
    title: 'Rather book than call?',
    sub: 'See live availability and reserve your family’s appointments online — no phone tag, no hold music.',
    surface: 'muted',
    cta: { label: 'Book online', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-optometry-family',
  name: 'sparx — Optometry (Family)',
  summary:
    'A warm, family-friendly optometry site — a clear teal palette, a warm coral accent and rounded type, with gentle, all-ages copy. Installs a working online booking flow for eye exams: real visit types (comprehensive and contact-lens exams, kids’ exams, dry-eye, medical visits and free frame styling), two optometrists and an optician booked by name with their own hours, exam rooms as resources, and a no-show hold policy. Ships as "Clearview Eye Care", a family eye-care practice.',
  tagline: 'A warm, family template for optometry practices — book eye exams online from day one.',
  industry: 'Optometry',
  sortWeight: 44,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'Clearview Eye Care', tagline: 'Clear vision for the whole family.' },
  theme: clearview,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Clearview Eye Care — a friendly family optometrist',
      description:
        'Clearview Eye Care is a warm, all-ages optometry practice for comprehensive eye exams, kids’ vision, contacts, dry-eye help, medical eye visits and glasses. New patients welcome — book an eye exam online.',
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
