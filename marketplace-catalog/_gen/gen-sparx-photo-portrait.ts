// sparx-photo-portrait — "Frame & Field", a bright, modern FAMILY / PORTRAIT studio.
//
// The joyful, contemporary, studio-led photographer: a crisp near-white ground, a clean
// coral primary, a teal accent and a modern sans display, with bright, airy photography
// carrying the page. Deliberately the OPPOSITE of the wedding template (warm, romantic,
// film) — same booking spine, a different business: mini-sessions, family, newborn,
// headshots and personal branding, booked online with a photographer AND a studio.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-photo-portrait.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-photo-portrait/**" \
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
  hero: 'photo-portrait-hero',
  studio: 'photo-portrait-studio',
  nadia: 'photo-portrait-nadia',
  theo: 'photo-portrait-theo',
  iris: 'photo-portrait-iris',
  work1: 'photo-portrait-work1',
  work2: 'photo-portrait-work2',
  work3: 'photo-portrait-work3',
  work4: 'photo-portrait-work4',
} as const;

const PHOTO: Record<string, string> = {
  "framefield-hero": "https://images.unsplash.com/photo-1707454301491-3ae3acea8aa7?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZmFtaWx5JTIwcG9ydHJhaXQlMjBwaG90b2dyYXBoeXxlbnwwfDB8fHwxNzg2MzkwNjUwfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "framefield-studio": "https://images.unsplash.com/photo-1668453814676-c8093305fae6?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGhvdG9ncmFwaHklMjBzdHVkaW8lMjBpbnRlcmlvcnxlbnwwfDB8fHwxNzg2MzkwNjUzfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "framefield-nadia": "https://images.unsplash.com/photo-1541516160071-4bb0c5af65ba?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjBwaG90b2dyYXBoZXIlMjBwb3J0cmFpdHxlbnwwfDB8fHwxNzg2MzkwNjI2fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "framefield-theo": "https://images.unsplash.com/photo-1475274226786-e636f48a5645?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGhvdG9ncmFwaGVyJTIwcG9ydHJhaXQlMjBtYW58ZW58MHwwfHx8MTc4NjM5MDYyM3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "framefield-iris": "https://images.unsplash.com/photo-1541516160071-4bb0c5af65ba?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGhvdG9ncmFwaGVyJTIwd29tYW4lMjBjYW1lcmF8ZW58MHwwfHx8MTc4NjM5MDY1N3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "framefield-work1": "https://images.unsplash.com/photo-1742522211724-3425d697bbf0?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZmFtaWx5JTIwcGhvdG8lMjBzZXNzaW9uJTIwb3V0ZG9vcnxlbnwwfDB8fHwxNzg2MzkwNjU5fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "framefield-work2": "https://images.unsplash.com/photo-1591161555818-7b9debeccc07?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bmV3Ym9ybiUyMGJhYnklMjBwaG90b2dyYXBoeXxlbnwwfDB8fHwxNzg2MzkwNjYyfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "framefield-work3": "https://images.unsplash.com/photo-1699899657680-421c2c2d5064?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YnVzaW5lc3MlMjBoZWFkc2hvdCUyMHBvcnRyYWl0fGVufDB8MHx8fDE3ODYzOTA2NjV8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "framefield-work4": "https://images.unsplash.com/photo-1497881807663-38b9a95b7192?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2hpbGQlMjBwb3J0cmFpdCUyMHNtaWxpbmd8ZW58MHwwfHx8MTc4NjM5MDY2OHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (seed: string): string =>
  PHOTO[seed] ?? `https://picsum.photos/seed/${seed}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}
const ASSETS: Asset[] = [
  { id: IMG.hero, url: src('framefield-hero'), alt: 'A family laughing together in a bright, sunlit studio' },
  { id: IMG.studio, url: src('framefield-studio'), alt: 'A clean, airy portrait studio with big windows' },
  { id: IMG.nadia, url: src('framefield-nadia'), alt: 'Nadia Brooks, family & newborn photographer' },
  { id: IMG.theo, url: src('framefield-theo'), alt: 'Theo Marsh, branding & headshot photographer' },
  { id: IMG.iris, url: src('framefield-iris'), alt: 'Iris Vaughn, portrait & maternity photographer' },
  { id: IMG.work1, url: src('framefield-work1'), alt: 'A joyful family portrait in soft daylight' },
  { id: IMG.work2, url: src('framefield-work2'), alt: 'A newborn curled up in a soft wrap' },
  { id: IMG.work3, url: src('framefield-work3'), alt: 'A confident personal-branding headshot' },
  { id: IMG.work4, url: src('framefield-work4'), alt: 'A relaxed maternity portrait by a window' },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-photo-portrait: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "framefield": near-white ground, clean coral primary, teal accent, modern sans ─
const framefield = defineTheme({
  name: 'framefield',
  type: { body: face('Inter', 'sans-serif'), head: face('Outfit', 'sans-serif') },
  shape: { selector: '0.75rem', field: '0.625rem', box: '1rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(98.5% 0.004 60)', // crisp near-white
      'oklch(96% 0.008 55)', // warm paper
      'oklch(91% 0.012 55)', // hairline
      'oklch(26% 0.03 262)', // deep slate ink
    ],
    roles: {
      primary: 'oklch(68% 0.16 28)', // clean coral
      secondary: 'oklch(36% 0.035 262)', // dark slate (readable micro-labels)
      accent: 'oklch(70% 0.11 195)', // fresh teal
      neutral: 'oklch(30% 0.025 262)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(22% 0.022 262)',
      'oklch(18% 0.018 262)',
      'oklch(14% 0.014 262)',
      'oklch(96% 0.005 60)',
    ],
    roles: {
      primary: 'oklch(73% 0.15 30)',
      secondary: 'oklch(80% 0.02 262)',
      accent: 'oklch(76% 0.1 195)',
      neutral: 'oklch(83% 0.015 262)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the booking spine (policies, photographers + studio + hours, sessions) ──
const hours = (days: number[], startMinute: number, endMinute: number) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

const SCHEDULING = {
  policies: [
    {
      handle: 'session-standard',
      name: 'Standard booking',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [1440, 120],
      policyText:
        'Please give us at least 24 hours’ notice to reschedule or cancel. We’ll send a reminder the day before and two hours ahead.',
    },
    {
      handle: 'session-deposit',
      name: 'Session deposit',
      depositType: 'deposit',
      depositAmountCents: 5000,
      cancellationWindowHours: 48,
      reminderOffsetsMin: [2880, 1440, 120],
      policyText:
        'Booked sessions hold a $50 deposit that comes off your total. Reschedule with 48 hours’ notice and it carries right over.',
    },
  ],
  resources: [
    {
      handle: 'nadia',
      name: 'Nadia Brooks',
      kind: 'staff',
      skillTags: ['family', 'newborn', 'maternity', 'portrait'],
      windows: hours([2, 3, 4, 5, 6], 540, 1020), // Tue–Sat 9–5
    },
    {
      handle: 'theo',
      name: 'Theo Marsh',
      kind: 'staff',
      skillTags: ['branding', 'headshot', 'portrait'],
      windows: hours([1, 2, 3, 4, 5], 600, 1080), // Mon–Fri 10–6
    },
    {
      handle: 'iris',
      name: 'Iris Vaughn',
      kind: 'staff',
      skillTags: ['family', 'maternity', 'portrait'],
      windows: hours([3, 4, 5, 6, 0], 600, 1020), // Wed–Sun 10–5
    },
    {
      handle: 'the-loft',
      name: 'The Loft Studio',
      kind: 'space',
      skillTags: ['studio'],
      windows: hours([1, 2, 3, 4, 5, 6, 0], 540, 1080), // every day 9–6
    },
  ],
  services: [
    {
      handle: 'consultation',
      name: 'Session consultation',
      description: 'A free, no-pressure call to plan your session — outfits, timing, the look you’re after.',
      durationMinutes: 20,
      priceCents: 0,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'photographer', kind: 'staff', skillTags: ['portrait'], count: 1 },
      ],
      policyHandle: 'session-standard',
    },
    {
      handle: 'mini-session',
      name: 'Mini session',
      description: 'A quick, bright studio sitting — perfect for a seasonal update or a single great portrait.',
      durationMinutes: 20,
      priceCents: 12500,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'photographer', kind: 'staff', skillTags: ['portrait'], count: 1 },
        { role: 'studio', kind: 'space', skillTags: ['studio'], count: 1 },
      ],
      policyHandle: 'session-deposit',
    },
    {
      handle: 'family-session',
      name: 'Family session',
      description: 'A relaxed, playful session on location — the park, the beach or your own home.',
      durationMinutes: 90,
      priceCents: 32500,
      bufferAfterMin: 15,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'photographer', kind: 'staff', skillTags: ['family'], count: 1 },
      ],
      policyHandle: 'session-deposit',
    },
    {
      handle: 'newborn-session',
      name: 'Newborn session',
      description: 'A gentle, unhurried studio session in the first few weeks — soft light, lots of cuddles.',
      durationMinutes: 90,
      priceCents: 38500,
      bufferAfterMin: 15,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'photographer', kind: 'staff', skillTags: ['newborn'], count: 1 },
        { role: 'studio', kind: 'space', skillTags: ['studio'], count: 1 },
      ],
      policyHandle: 'session-deposit',
    },
    {
      handle: 'branding-session',
      name: 'Personal branding session',
      description: 'On-brand portraits for your website, socials and press — planned around your business.',
      durationMinutes: 75,
      priceCents: 45000,
      bufferAfterMin: 10,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'photographer', kind: 'staff', skillTags: ['branding'], count: 1 },
        { role: 'studio', kind: 'space', skillTags: ['studio'], count: 1 },
      ],
      policyHandle: 'session-deposit',
    },
    {
      handle: 'headshot-session',
      name: 'Headshot session',
      description: 'A crisp, confident studio headshot — quick, easy and ready for LinkedIn the same week.',
      durationMinutes: 30,
      priceCents: 18500,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'photographer', kind: 'staff', skillTags: ['headshot'], count: 1 },
        { role: 'studio', kind: 'space', skillTags: ['studio'], count: 1 },
      ],
      policyHandle: 'session-deposit',
    },
    {
      handle: 'maternity-session',
      name: 'Maternity session',
      description: 'A calm, glowing session on location or in the studio, celebrating the last few weeks.',
      durationMinutes: 60,
      priceCents: 29500,
      bufferAfterMin: 10,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'photographer', kind: 'staff', skillTags: ['maternity'], count: 1 },
      ],
      policyHandle: 'session-deposit',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  photoHero({
    image: url(IMG.hero),
    alt: 'A family laughing together in a bright, sunlit studio',
    title: 'Bright, joyful portraits of the people you love',
    sub: 'A light-filled studio for families, newborns, headshots and personal branding — easy to book, genuinely fun to sit for.',
    primary: { label: 'Book a session', href: '/book' },
    secondary: { label: 'See session types', href: '/book' },
    overlay: 'dark',
  }),
  featureRow({
    items: [
      {
        title: 'Studio & on-location',
        body: 'Sit in our airy studio or head out to the park, the beach or your own front room — whatever feels most like you.',
      },
      {
        title: 'Quick, easy booking',
        body: 'Pick a session, choose your photographer and see live times online. No phone tag, no back-and-forth.',
      },
      {
        title: 'Prints & digitals',
        body: 'Every session comes with beautifully edited digital images, and prints and albums you’ll actually want on the wall.',
      },
      {
        title: 'Seasonal mini-sessions',
        body: 'Short, bright sittings a few times a year — an easy way to keep up with how fast everyone’s growing.',
      },
    ],
  }),
  serviceMenu({
    heading: 'Sessions',
    intro: 'A session for every stage. Full prices and live availability are on the booking page.',
    surface: 'muted',
    columns: 2,
    items: [
      { name: 'Mini session', priceCents: 12500, durationMin: 20, desc: 'A quick, bright studio sitting.' },
      { name: 'Family session', priceCents: 32500, durationMin: 90, desc: 'Relaxed and playful, on location.' },
      { name: 'Newborn session', priceCents: 38500, durationMin: 90, desc: 'Gentle and unhurried in-studio.' },
      { name: 'Personal branding', priceCents: 45000, durationMin: 75, desc: 'On-brand portraits for your business.' },
      { name: 'Headshot session', priceCents: 18500, durationMin: 30, desc: 'Crisp, confident and quick.' },
      { name: 'Maternity session', priceCents: 29500, durationMin: 60, desc: 'A calm, glowing celebration.' },
    ],
    cta: { label: 'See everything & book', href: '/book' },
  }),
  galleryStrip({
    heading: 'Recent work',
    columns: 4,
    images: [
      { src: url(IMG.work1), alt: 'A joyful family portrait in soft daylight' },
      { src: url(IMG.work2), alt: 'A newborn curled up in a soft wrap' },
      { src: url(IMG.work3), alt: 'A confident personal-branding headshot' },
      { src: url(IMG.work4), alt: 'A relaxed maternity portrait by a window' },
    ],
  }),
  splitFeature({
    image: url(IMG.studio),
    alt: 'A clean, airy portrait studio with big windows',
    heading: 'A studio that feels easy',
    body: [
      'Frame & Field is a bright, window-lit studio built to feel relaxed — space for kids to be kids, room to move, and no stiff “say cheese” energy.',
      'We keep the day unhurried and let real moments happen. That’s where the portraits you keep forever actually come from.',
    ],
    cta: { label: 'Book your session', href: '/book' },
  }),
  teamRow({
    heading: 'Meet the photographers',
    intro: 'Book by name — you’ll work with someone who loves exactly the kind of session you’re after.',
    surface: 'muted',
    members: [
      { name: 'Nadia Brooks', role: 'Family & newborn', image: url(IMG.nadia), alt: 'Nadia Brooks, family & newborn photographer', bio: 'Patient, playful and endlessly calm with the tiniest clients. Nadia leads the studio.' },
      { name: 'Theo Marsh', role: 'Branding & headshots', image: url(IMG.theo), alt: 'Theo Marsh, branding & headshot photographer', bio: 'Clean, confident portraits for founders, teams and personal brands.' },
      { name: 'Iris Vaughn', role: 'Portrait & maternity', image: url(IMG.iris), alt: 'Iris Vaughn, portrait & maternity photographer', bio: 'Soft daylight, real connection, and sessions that never feel posed.' },
    ],
  }),
  testimonial({
    quote: 'Our kids actually had fun, and the photos look like us on our best day. Booking took two minutes.',
    attribution: 'The Alvarez family, clients since 2024',
  }),
  bookingCta({
    title: 'Let’s make something you’ll frame',
    sub: 'Pick a session, choose your photographer and see live times. It takes about a minute.',
    cta: { label: 'Book a session', href: '/book' },
  }),
];

const BOOK_INTRO = [
  photoHero({
    image: url(IMG.studio),
    alt: 'A clean, airy portrait studio with big windows',
    title: 'Book your session',
    sub: 'Choose a session type to see prices and live availability, then pick your photographer and time.',
    primary: { label: 'See sessions below', href: '/book' },
    overlay: 'darker',
    align: 'start',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.hero),
    alt: 'A family laughing together in a bright, sunlit studio',
    heading: 'About Frame & Field',
    body: [
      'We started Frame & Field to make portrait photography feel light — bright rooms, real laughter, and none of the stiff, awkward posing most people dread.',
      'From first babies to fast-growing families, fresh headshots to full personal-branding shoots, we’re here for the moments worth keeping. And every one is easy to book online.',
    ],
    cta: { label: 'Book a session', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'How a session works',
    items: [
      { title: 'Plan it together', body: 'Start with a quick consultation — we’ll talk outfits, timing, location and the feeling you want the photos to have.' },
      { title: 'Have fun on the day', body: 'We keep it relaxed and playful, follow the energy in the room, and catch the real, in-between moments.' },
      { title: 'Choose your favourites', body: 'A week or two later you’ll view your gallery and pick the digitals, prints and albums you love.' },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Visit the studio',
    address: ['Frame & Field', '54 Maple Row', 'Studio C · Denver, CO 80205'],
    mapLocation: '54 Maple Row, Denver, CO 80205',
    hours: [
      { day: 'Monday – Friday', time: '9:00 – 6:00' },
      { day: 'Saturday', time: '9:00 – 5:00' },
      { day: 'Sunday', time: '10:00 – 5:00' },
    ],
  }),
  bookingCta({
    title: 'Rather book than call?',
    sub: 'See live availability and reserve your session online — no phone tag.',
    surface: 'muted',
    cta: { label: 'Book a session', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-photo-portrait',
  name: 'sparx — Photography (Portrait)',
  summary:
    'A bright, modern family & portrait photography site — a fresh coral palette, a crisp near-white ground and a clean modern sans, with a joyful session menu. Installs a working booking flow: real session types (mini, family, newborn, branding, headshots), photographers you book by name with their own hours, a studio space in-studio sessions reserve, and a session-deposit policy. Ships as "Frame & Field", a light-filled portrait studio.',
  tagline: 'A bright, modern template for portrait photographers — book online from day one.',
  industry: 'Photography',
  sortWeight: 59,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'Frame & Field', tagline: 'Bright, joyful portraits — easy to book.' },
  theme: framefield,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Frame & Field — a bright family & portrait studio',
      description:
        'Frame & Field is a light-filled studio for family, newborn, maternity, headshot and personal-branding photography. Book your photographer online.',
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
