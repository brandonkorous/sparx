// sparx-esthetics-glow — "Dewy Skin Bar", a fun, relaxing EXPRESS-FACIAL & GLOW BAR.
//
// The playful, feel-good end of the esthetics lane: quick express facials, fun add-ons
// (LED, gua sha), glow memberships and "a glow on your lunch break". A bright, dewy palette
// (fresh peach-coral primary, aqua accent, warm off-white ground), rounded friendly type,
// and an express-menu / membership structure. Deliberately the OPPOSITE of the results-driven
// clinical skin studio sibling (calm, minimal, treatment-plan led) — same booking spine, a
// visibly different, bubblier business. The booking core is a facial: "Book a glow."
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-esthetics-glow.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-esthetics-glow/**" \
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
  hero: 'esthetics-glow-hero',
  studio: 'esthetics-glow-studio',
  mila: 'esthetics-glow-mila',
  priya: 'esthetics-glow-priya',
  jade: 'esthetics-glow-jade',
} as const;

const PHOTO: Record<string, string> = {
  "dewy-hero": "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Z2xvd2luZyUyMHNraW4lMjBmYWNpYWx8ZW58MHwwfHx8MTc4NjM5MjcwNXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "dewy-priya": "https://images.unsplash.com/photo-1506863530036-1efeddceb993?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjBza2luY2FyZSUyMHBvcnRyYWl0fGVufDB8MHx8fDE3ODYzOTI3MTB8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "dewy-mila": "https://images.unsplash.com/photo-1762341113869-0bfa616b4457?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjBiZWF1dHklMjB0aGVyYXBpc3QlMjBwb3J0cmFpdHxlbnwwfDB8fHwxNzg2MzkyNzQzfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "dewy-jade": "https://images.unsplash.com/photo-1506863530036-1efeddceb993?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YmVhdXRpY2lhbiUyMHBvcnRyYWl0fGVufDB8MHx8fDE3ODYzOTI3NDR8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (seed: string): string =>
  PHOTO[seed] ?? `https://picsum.photos/seed/${seed}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}
const ASSETS: Asset[] = [
  { id: IMG.hero, url: src('dewy-hero'), alt: 'Fresh, dewy, glowing skin in bright natural light' },
  { id: IMG.studio, url: src('dewy-studio'), alt: 'A bright, cheerful glow bar with a comfy treatment chair' },
  { id: IMG.mila, url: src('dewy-mila'), alt: 'Mila Fox, esthetician' },
  { id: IMG.priya, url: src('dewy-priya'), alt: 'Priya Anand, esthetician' },
  { id: IMG.jade, url: src('dewy-jade'), alt: 'Jade Nguyen, esthetician' },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-esthetics-glow: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "dewy": warm off-white ground, bright peach-coral primary, aqua accent ─────
const dewy = defineTheme({
  name: 'dewy',
  type: { body: face('Inter', 'sans-serif'), head: face('Quicksand', 'sans-serif') },
  shape: { selector: '0.875rem', field: '0.875rem', box: '1.25rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(98% 0.014 70)', // warm dewy off-white
      'oklch(95% 0.022 62)', // soft peach cream
      'oklch(90% 0.024 58)', // hairline
      'oklch(30% 0.03 42)', // warm dark ink
    ],
    roles: {
      primary: 'oklch(73% 0.145 38)', // bright peach-coral
      secondary: 'oklch(38% 0.03 42)', // warm dark — readable micro-labels on the light ground
      accent: 'oklch(80% 0.105 195)', // fresh aqua
      neutral: 'oklch(32% 0.022 45)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(26% 0.022 40)',
      'oklch(22% 0.018 40)',
      'oklch(18% 0.014 40)',
      'oklch(96% 0.014 70)',
    ],
    roles: {
      primary: 'oklch(79% 0.14 40)',
      secondary: 'oklch(82% 0.02 72)',
      accent: 'oklch(83% 0.1 195)',
      neutral: 'oklch(85% 0.016 72)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the glow spine (policies, estheticians + rooms + hours, the express menu) ─
const hours = (days: number[], startMinute: number, endMinute: number) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

// Every service pairs an esthetician (any of ours works — all carry 'facial') with an open
// treatment room. A multi-requirement booking: staff + space, both must be free.
const GLOW_REQ = [
  { role: 'esthetician', kind: 'staff', skillTags: ['facial'], count: 1 },
  { role: 'room', kind: 'space', skillTags: ['treatment-room'], count: 1 },
];

const SCHEDULING = {
  policies: [
    {
      handle: 'glow-standard',
      name: 'Standard booking',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [1440, 120],
      policyText:
        'Life happens — just give us 24 hours to reschedule or cancel. We’ll text a reminder the day before and two hours ahead so a glow never sneaks up on you.',
    },
    {
      handle: 'glow-noshow',
      name: 'No-show policy',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [1440, 120],
      policyText:
        'Booked facials hold your chair. A no-show or a cancel inside 24 hours may be charged 50% of the service — a heads-up text keeps you in the clear.',
    },
  ],
  resources: [
    {
      handle: 'mila',
      name: 'Mila Fox',
      kind: 'staff',
      skillTags: ['facial', 'express', 'led'],
      windows: hours([2, 3, 4, 5, 6], 600, 1080), // Tue–Sat 10–6
    },
    {
      handle: 'priya',
      name: 'Priya Anand',
      kind: 'staff',
      skillTags: ['facial', 'guasha', 'express'],
      windows: hours([3, 4, 5, 6, 0], 660, 1200), // Wed–Sun 11–8
    },
    {
      handle: 'jade',
      name: 'Jade Nguyen',
      kind: 'staff',
      skillTags: ['facial', 'express', 'addons'],
      windows: hours([2, 4, 5, 6], 600, 1140), // Tue, Thu–Sat 10–7
    },
    {
      handle: 'room-1',
      name: 'Glow Room 1',
      kind: 'space',
      skillTags: ['treatment-room'],
      windows: hours([2, 3, 4, 5, 6, 0], 600, 1200), // Tue–Sun 10–8
    },
    {
      handle: 'room-2',
      name: 'Glow Room 2',
      kind: 'space',
      skillTags: ['treatment-room'],
      windows: hours([2, 3, 4, 5, 6, 0], 600, 1200), // Tue–Sun 10–8
    },
  ],
  services: [
    {
      handle: 'express-glow-facial',
      name: 'Express glow facial',
      description: 'Cleanse, exfoliate, mask and a dewy finish — a proper glow on your lunch break.',
      durationMinutes: 30,
      priceCents: 4500,
      assignmentStrategy: 'any_available',
      resourceRequirements: GLOW_REQ,
      policyHandle: 'glow-noshow',
    },
    {
      handle: 'signature-glow-facial',
      name: 'Signature glow facial',
      description: 'The full feel-good ritual — deep cleanse, custom mask, massage and glow serum.',
      durationMinutes: 45,
      priceCents: 7500,
      bufferAfterMin: 10,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: GLOW_REQ,
      policyHandle: 'glow-noshow',
    },
    {
      handle: 'hydrating-facial',
      name: 'Dewy hydration facial',
      description: 'Thirsty skin, meet its match — layers of hydration for a plump, bouncy glow.',
      durationMinutes: 45,
      priceCents: 7000,
      bufferAfterMin: 10,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: GLOW_REQ,
      policyHandle: 'glow-noshow',
    },
    {
      handle: 'brightening-facial',
      name: 'Bright-eyed brightening facial',
      description: 'Even, wake-up-your-face radiance with a vitamin-C boost and a cool finish.',
      durationMinutes: 45,
      priceCents: 8000,
      bufferAfterMin: 10,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: GLOW_REQ,
      policyHandle: 'glow-noshow',
    },
    {
      handle: 'led-add-on',
      name: 'LED light add-on',
      description: 'Ten minutes under the glow lights — calming, brightening, extra dewy.',
      durationMinutes: 15,
      priceCents: 2500,
      assignmentStrategy: 'any_available',
      resourceRequirements: GLOW_REQ,
      policyHandle: 'glow-standard',
    },
    {
      handle: 'gua-sha-add-on',
      name: 'Gua sha add-on',
      description: 'A sculpting, de-puffing gua sha massage to send you out extra snatched.',
      durationMinutes: 15,
      priceCents: 2000,
      assignmentStrategy: 'any_available',
      resourceRequirements: GLOW_REQ,
      policyHandle: 'glow-standard',
    },
    {
      handle: 'dewy-membership-consult',
      name: 'Glow membership chat',
      description: 'A free, no-pressure sit-down to build the membership that fits your skin and budget.',
      durationMinutes: 20,
      priceCents: 0,
      assignmentStrategy: 'any_available',
      resourceRequirements: GLOW_REQ,
      policyHandle: 'glow-standard',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  photoHero({
    image: url(IMG.hero),
    alt: 'Fresh, dewy, glowing skin in bright natural light',
    title: 'Glow on your lunch break',
    sub: 'Quick, feel-good express facials at the glow bar — walk in dull, walk out dewy. No downtime, all glow.',
    primary: { label: 'Book a glow', href: '/book' },
    secondary: { label: 'See the menu', href: '/book' },
    overlay: 'soft',
  }),
  featureRow({
    items: [
      {
        title: 'Express, walk-in-friendly facials',
        body: 'Thirty happy minutes, in and out on your break. Book ahead or pop in — a fresh glow fits any day.',
      },
      {
        title: 'Glow memberships',
        body: 'Make the glow a habit. Members get a monthly facial, add-on perks and friends-and-family pricing.',
      },
      {
        title: 'Fun little add-ons',
        body: 'Stack an LED session or a sculpting gua sha onto any facial and float out extra dewy.',
      },
    ],
  }),
  serviceMenu({
    heading: 'The glow menu',
    intro: 'Express facials and fun add-ons — pick your glow. Live times and full prices are on the booking page.',
    surface: 'muted',
    columns: 2,
    items: [
      { name: 'Express glow facial', priceCents: 4500, durationMin: 30, desc: 'A dewy glow on your lunch break.' },
      { name: 'Signature glow facial', priceCents: 7500, durationMin: 45, desc: 'The full feel-good ritual.' },
      { name: 'Dewy hydration facial', priceCents: 7000, durationMin: 45, desc: 'Layers of plump, bouncy hydration.' },
      { name: 'LED light add-on', priceCents: 2500, durationMin: 15, desc: 'Ten minutes under the glow lights.' },
    ],
    cta: { label: 'See everything & book', href: '/book' },
  }),
  splitFeature({
    image: url(IMG.studio),
    alt: 'A bright, cheerful glow bar with a comfy treatment chair',
    heading: 'Glow on your schedule',
    body: [
      'The Dewy membership is the easy way to keep your glow going: one express or signature facial a month, member pricing on every add-on, and roll-over if life gets busy.',
      'No lock-in, no fine print you need a magnifying glass for. Pause it, share it, or cancel any time — it’s your glow, your call.',
    ],
    cta: { label: 'Chat memberships', href: '/book' },
  }),
  teamRow({
    heading: 'Your glow team',
    intro: 'Book by name — a friendly esthetician who learns your skin and roots for your glow.',
    members: [
      { name: 'Mila Fox', role: 'Esthetician · Express & LED', image: url(IMG.mila), alt: 'Mila Fox, esthetician', bio: 'Speedy express facials and glow-light sessions. Mila runs the bar.' },
      { name: 'Priya Anand', role: 'Esthetician · Gua sha', image: url(IMG.priya), alt: 'Priya Anand, esthetician', bio: 'Sculpting gua sha and a calming, feel-good touch.' },
      { name: 'Jade Nguyen', role: 'Esthetician · Add-ons', image: url(IMG.jade), alt: 'Jade Nguyen, esthetician', bio: 'The add-on queen — she’ll send you out extra dewy.' },
    ],
  }),
  testimonial({
    quote: 'I pop in on my lunch break and leave actually glowing. It’s become my favourite little treat — fast, fun, zero fuss.',
    attribution: 'Sam, member since 2024',
    surface: 'primary',
  }),
  bookingCta({
    title: 'Ready to glow?',
    sub: 'Pick a facial, add a little extra, and grab a time. It takes about a minute.',
    cta: { label: 'Book a glow', href: '/book' },
  }),
];

const BOOK_INTRO = [
  photoHero({
    image: url(IMG.studio),
    alt: 'A bright, cheerful glow bar with a comfy treatment chair',
    title: 'Book a glow',
    sub: 'Choose a facial to see live times, add an LED or gua sha if you fancy, and pick your esthetician.',
    primary: { label: 'See the menu below', href: '/book' },
    overlay: 'dark',
    align: 'start',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.hero),
    alt: 'Fresh, dewy, glowing skin in bright natural light',
    heading: 'About Dewy Skin Bar',
    body: [
      'We started Dewy Skin Bar because good skin shouldn’t mean a two-hour appointment and a scary bill. Glowing skin should feel fun, quick and completely doable.',
      'So we built a glow bar: express facials you can fit on a lunch break, playful add-ons, and memberships that keep the glow going — all in a bright, easy space where nobody makes you feel bad about your pores.',
    ],
    cta: { label: 'Book a glow', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'How the glow bar works',
    items: [
      { title: 'Quick by design', body: 'Express facials are built for real life — 30 dewy minutes, no downtime, back to your day.' },
      { title: 'Skin you’ll actually see', body: 'Gentle, feel-good treatments that leave you plump, bright and glowing — not red and raw.' },
      { title: 'Keep it going', body: 'Memberships and add-ons make the glow a habit, at prices that don’t need a special occasion.' },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Find the glow bar',
    address: ['Dewy Skin Bar', '54 Maple Court', 'Unit 3 · Austin, TX 78704'],
    mapLocation: '54 Maple Court, Austin, TX 78704',
    hours: [
      { day: 'Tuesday – Saturday', time: '10:00 – 8:00' },
      { day: 'Sunday', time: '10:00 – 6:00' },
      { day: 'Monday', time: 'Closed' },
    ],
  }),
  bookingCta({
    title: 'Rather book than call?',
    sub: 'See live times and grab your glow online — no phone tag, no hold music.',
    surface: 'muted',
    cta: { label: 'Book a glow', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-esthetics-glow',
  name: 'Esthetics (Glow Bar)',
  summary:
    'A playful, dewy express-facial glow bar — a bright peach-coral palette, aqua accent and rounded, friendly type. Installs a working booking flow: express facials, hydration and brightening treatments, and fun add-ons (LED, gua sha), with three estheticians and two treatment rooms as bookable resources so every glow pairs a face and a room. Ships as "Dewy Skin Bar", a fun, feel-good glow on your lunch break.',
  tagline: 'A playful, dewy template for express facial bars — book a glow from day one.',
  industry: 'Esthetics',
  sortWeight: 37,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'Dewy Skin Bar', tagline: 'Glow on your lunch break.' },
  theme: dewy,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Dewy Skin Bar — express facials & glow bar',
      description:
        'Dewy Skin Bar is a fun, feel-good glow bar for quick express facials, LED and gua sha add-ons, and glow memberships. Book your glow online.',
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
