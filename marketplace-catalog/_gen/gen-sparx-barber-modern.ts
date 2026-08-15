// sparx-barber-modern — "Fade Room", a MODERN fade barbershop.
//
// The clean, bright, high-energy fade shop — light near-white ground, near-black ink,
// an electric-blue primary and a bold-red accent, a tall condensed display (Oswald) over
// a plain sans (Inter). Deliberately the OPPOSITE of the heritage barber template (dark,
// vintage, blade-and-brass): this one is punchy and no-nonsense, leading with a TYPE hero
// instead of a photograph. Same booking spine, a different business.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-barber-modern.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-barber-modern/**" \
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
  typeHero,
  type ServiceSiteSpec,
} from './service-sites/harness';

// ── Imagery (swap-ready; each id also names an entry in ASSETS) ────────────────────
const IMG = {
  shop: 'barber-modern-shop',
  chairs: 'barber-modern-chairs',
  marcus: 'barber-modern-marcus',
  deshawn: 'barber-modern-deshawn',
  tony: 'barber-modern-tony',
  work1: 'barber-modern-work1',
  work2: 'barber-modern-work2',
  work3: 'barber-modern-work3',
} as const;

const PHOTO: Record<string, string> = {
  "faderoom-shop": "https://images.unsplash.com/photo-1596362601603-b74f6ef166e4?w=1600&q=80",
  "faderoom-chairs": "https://images.unsplash.com/photo-1541533848490-bc8115cd6522?w=1600&q=80",
  "faderoom-marcus": "https://images.unsplash.com/photo-1717700921740-a1440f3b89a4?w=1600&q=80",
  "faderoom-deshawn": "https://images.unsplash.com/photo-1595294572864-ddb46d169dbb?w=1600&q=80",
  "faderoom-tony": "https://images.unsplash.com/photo-1619233543112-fe382ff3693d?w=1600&q=80",
  "faderoom-work1": "https://images.unsplash.com/photo-1593702295094-aea22597af65?w=1600&q=80",
  "faderoom-work2": "https://images.unsplash.com/photo-1605497787865-e6d4762b386f?w=1600&q=80",
  "faderoom-work3": "https://images.unsplash.com/photo-1604355240616-5e907f42b431?w=1600&q=80",
};
const src = (seed: string): string =>
  PHOTO[seed] ?? `https://picsum.photos/seed/${seed}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}
const ASSETS: Asset[] = [
  { id: IMG.shop, url: src('faderoom-shop'), alt: 'A bright, modern barbershop with white walls and chrome chairs' },
  { id: IMG.chairs, url: src('faderoom-chairs'), alt: 'A row of clean styling stations under bright light' },
  { id: IMG.marcus, url: src('faderoom-marcus'), alt: 'Marcus Reed, master barber' },
  { id: IMG.deshawn, url: src('faderoom-deshawn'), alt: 'DeShawn Wells, barber' },
  { id: IMG.tony, url: src('faderoom-tony'), alt: 'Tony Alvarez, barber' },
  { id: IMG.work1, url: src('faderoom-work1'), alt: 'A crisp skin fade with a sharp line-up' },
  { id: IMG.work2, url: src('faderoom-work2'), alt: 'A textured crop with a clean taper' },
  { id: IMG.work3, url: src('faderoom-work3'), alt: 'A full cut and beard, edged tight' },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-barber-modern: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "faderoom": near-white ground, near-black ink, electric-blue primary,
//    bold-red accent, tall condensed Oswald display over Inter body ─────────────────
const faderoom = defineTheme({
  name: 'faderoom',
  type: { body: face('Inter', 'sans-serif'), head: face('Oswald', 'sans-serif') },
  shape: { selector: '0.25rem', field: '0.25rem', box: '0.25rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(98% 0.003 250)', // near-white
      'oklch(95% 0.004 250)', // light graphite
      'oklch(90% 0.006 250)', // hairline
      'oklch(20% 0.02 262)', // near-black ink
    ],
    roles: {
      primary: 'oklch(56% 0.2 255)', // electric blue
      secondary: 'oklch(44% 0.012 262)', // graphite
      accent: 'oklch(57% 0.21 26)', // bold red
      neutral: 'oklch(24% 0.012 262)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(22% 0.012 262)',
      'oklch(18% 0.01 262)',
      'oklch(14% 0.008 262)',
      'oklch(96% 0.003 250)',
    ],
    roles: {
      primary: 'oklch(68% 0.17 255)',
      secondary: 'oklch(74% 0.012 262)',
      accent: 'oklch(70% 0.18 26)',
      neutral: 'oklch(82% 0.012 262)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the booking spine (policy, barbers + hours, the service menu) ─────────
const hours = (days: number[], startMinute: number, endMinute: number) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

const SCHEDULING = {
  policies: [
    {
      handle: 'faderoom-standard',
      name: 'Standard booking',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [1440, 120],
      policyText:
        'Give us a heads-up at least 24 hours out if you need to move or cancel. We text a reminder the day before and two hours ahead so you never miss your slot.',
    },
  ],
  resources: [
    {
      handle: 'marcus',
      name: 'Marcus Reed',
      kind: 'staff',
      skillTags: ['fade', 'cut', 'beard', 'kids', 'hottowel'],
      windows: hours([2, 3, 4, 5, 6], 600, 1140), // Tue–Sat 10–7
    },
    {
      handle: 'deshawn',
      name: 'DeShawn Wells',
      kind: 'staff',
      skillTags: ['fade', 'cut', 'beard', 'hottowel'],
      windows: hours([3, 4, 5, 6, 0], 660, 1200), // Wed–Sun 11–8
    },
    {
      handle: 'tony',
      name: 'Tony Alvarez',
      kind: 'staff',
      skillTags: ['cut', 'beard', 'kids'],
      windows: hours([2, 4, 5, 6], 540, 1080), // Tue, Thu–Sat 9–6
    },
  ],
  services: [
    {
      handle: 'skin-fade',
      name: 'Skin fade',
      description: 'A clean fade down to the skin, blended tight and finished with a razor line-up.',
      durationMinutes: 45,
      priceCents: 4000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'barber', kind: 'staff', skillTags: ['fade'], count: 1 }],
      policyHandle: 'faderoom-standard',
    },
    {
      handle: 'taper-fade',
      name: 'Taper fade',
      description: 'A gradual taper around the ears and neckline — sharp, but a touch more grown-in.',
      durationMinutes: 45,
      priceCents: 3800,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'barber', kind: 'staff', skillTags: ['fade'], count: 1 }],
      policyHandle: 'faderoom-standard',
    },
    {
      handle: 'scissor-cut',
      name: 'Scissor cut',
      description: 'A scissor-over-comb cut for length and texture on top — no clippers, all shape.',
      durationMinutes: 45,
      priceCents: 4200,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'barber', kind: 'staff', skillTags: ['cut'], count: 1 }],
      policyHandle: 'faderoom-standard',
    },
    {
      handle: 'beard-lineup',
      name: 'Beard line-up',
      description: 'Razor-edged cheeks and neckline with the beard shaped and evened out.',
      durationMinutes: 20,
      priceCents: 2000,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'barber', kind: 'staff', skillTags: ['beard'], count: 1 }],
      policyHandle: 'faderoom-standard',
    },
    {
      handle: 'cut-beard',
      name: 'Cut + beard',
      description: 'The full reset — a fresh cut and a shaped, lined-up beard in one sitting.',
      durationMinutes: 60,
      priceCents: 5500,
      bufferAfterMin: 5,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'barber', kind: 'staff', skillTags: ['cut', 'beard'], count: 1 },
      ],
      policyHandle: 'faderoom-standard',
    },
    {
      handle: 'kids-cut',
      name: 'Kids cut',
      description: 'A quick, easy cut for the under-12s — in the chair, cleaned up and out the door.',
      durationMinutes: 30,
      priceCents: 2800,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'barber', kind: 'staff', skillTags: ['kids'], count: 1 }],
      policyHandle: 'faderoom-standard',
    },
    {
      handle: 'buzz-hot-towel',
      name: 'Buzz + hot towel',
      description: 'A one-length buzz finished with a hot-towel neck shave — fast, clean, done right.',
      durationMinutes: 30,
      priceCents: 3000,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'barber', kind: 'staff', skillTags: ['hottowel'], count: 1 }],
      policyHandle: 'faderoom-standard',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  typeHero({
    title: 'Sharp cuts. No waiting. Book the chair.',
    sub: 'Fade Room is a modern barbershop built for one thing — a clean cut, done fast, done right. Pick your barber, grab a time, walk in sharp.',
    primary: { label: 'Book a chair', href: '/book' },
    secondary: { label: 'See the menu', href: '/book' },
    surface: 'base',
  }),
  serviceMenu({
    heading: 'The menu',
    intro: 'Straight prices, no add-on games. Live times and every service are on the booking page.',
    surface: 'muted',
    columns: 3,
    items: [
      { name: 'Skin fade', priceCents: 4000, durationMin: 45, desc: 'Faded to the skin, lined up sharp.' },
      { name: 'Taper fade', priceCents: 3800, durationMin: 45, desc: 'Clean taper around the edges.' },
      { name: 'Cut + beard', priceCents: 5500, durationMin: 60, desc: 'Full cut and a shaped beard.' },
      { name: 'Scissor cut', priceCents: 4200, durationMin: 45, desc: 'All shape, no clippers.' },
      { name: 'Beard line-up', priceCents: 2000, durationMin: 20, desc: 'Razor-edged and evened out.' },
      { name: 'Buzz + hot towel', priceCents: 3000, durationMin: 30, desc: 'One length, hot-towel finish.' },
    ],
    cta: { label: 'See everything & book', href: '/book' },
  }),
  featureRow({
    items: [
      {
        title: 'In and out on time',
        body: 'Book a slot and it’s yours. We run to the clock, so you’re not losing an afternoon to a waiting bench.',
      },
      {
        title: 'Book the barber you want',
        body: 'Pick your guy by name and see his real availability. Same hands every visit, same cut every time.',
      },
      {
        title: 'One flat price, up front',
        body: 'What you see is what you pay. No mystery upsells at the mirror — just a straight rate for a straight cut.',
      },
    ],
  }),
  splitFeature({
    image: url(IMG.shop),
    alt: 'A bright, modern barbershop with white walls and chrome chairs',
    heading: 'Built like a machine, run like a shop',
    body: [
      'Fade Room is bright, fast and dialed in — clean stations, sharp tools and barbers who take the fade seriously. No clutter, no chaos.',
      'You book online, you show up, you get the cut. We keep the line moving so the chair is always ready when your time comes around.',
    ],
    cta: { label: 'Grab a time', href: '/book' },
  }),
  teamRow({
    heading: 'Your barbers',
    intro: 'Book by name — you’ll sit with the same barber every time.',
    members: [
      { name: 'Marcus Reed', role: 'Master barber', image: url(IMG.marcus), alt: 'Marcus Reed, master barber', bio: 'Fades, tapers and razor line-ups. Marcus runs the floor.' },
      { name: 'DeShawn Wells', role: 'Barber', image: url(IMG.deshawn), alt: 'DeShawn Wells, barber', bio: 'Skin fades and beard work, tight and clean every time.' },
      { name: 'Tony Alvarez', role: 'Barber', image: url(IMG.tony), alt: 'Tony Alvarez, barber', bio: 'Scissor work, kids cuts and classic shapes.' },
    ],
  }),
  galleryStrip({
    heading: 'Fresh out the chair',
    surface: 'muted',
    columns: 3,
    images: [
      { src: url(IMG.work1), alt: 'A crisp skin fade with a sharp line-up' },
      { src: url(IMG.work2), alt: 'A textured crop with a clean taper' },
      { src: url(IMG.work3), alt: 'A full cut and beard, edged tight' },
    ],
  }),
  bookingCta({
    title: 'Chair’s open. Come get sharp.',
    sub: 'Pick a service, choose your barber and grab a live time. Takes about a minute.',
    cta: { label: 'Book a chair', href: '/book' },
  }),
];

const BOOK_INTRO = [
  photoHero({
    image: url(IMG.chairs),
    alt: 'A row of clean styling stations under bright light',
    title: 'Book your chair',
    sub: 'Pick a service to see the price and live times, then choose your barber and lock it in.',
    primary: { label: 'See services below', href: '/book' },
    overlay: 'darker',
    align: 'start',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.shop),
    alt: 'A bright, modern barbershop with white walls and chrome chairs',
    heading: 'About Fade Room',
    body: [
      'We started Fade Room because getting a good cut shouldn’t mean guessing at a wait time and hoping for the best. So we built the shop around the booking — pick your barber, pick your slot, done.',
      'Bright room, sharp tools, barbers who actually care about the fade. No frills, no waiting bench, no surprise prices. Just a clean cut on your schedule.',
    ],
    cta: { label: 'Book a chair', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'How we run',
    items: [
      { title: 'On the clock', body: 'Every cut is booked to a real slot and we hold the line to it, so your time means your time.' },
      { title: 'Barbers who own it', body: 'You book a person, not a queue. Your barber learns your cut and delivers it the same way every visit.' },
      { title: 'Straight pricing', body: 'One flat rate per service, shown before you book. What you see on the menu is what you pay in the chair.' },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Find the shop',
    address: ['Fade Room', '210 Ironside Ave', 'Unit 4 · Denver, CO 80205'],
    mapLocation: '210 Ironside Ave, Denver, CO 80205',
    hours: [
      { day: 'Tuesday – Friday', time: '9:00 – 8:00' },
      { day: 'Saturday', time: '9:00 – 7:00' },
      { day: 'Sunday', time: '11:00 – 5:00' },
      { day: 'Monday', time: 'Closed' },
    ],
  }),
  bookingCta({
    title: 'Skip the call — book online',
    sub: 'See live times and lock in your chair in about a minute. No phone tag.',
    surface: 'muted',
    cta: { label: 'Book a chair', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-barber-modern',
  name: 'Barbershop (Modern)',
  summary:
    'A modern, high-energy barbershop site — a clean near-white palette, an electric-blue primary and a bold-red accent, with a tall condensed display and a type-first hero that leads with attitude over a photo. Installs a working booking flow: a real service menu (skin fade, taper, cut + beard, kids cut), three barbers you book by name with their own hours, and a standard no-deposit policy. Ships as "Fade Room", a fast, dialed-in fade shop.',
  tagline: 'A punchy, modern template for barbershops — book online from day one.',
  industry: 'Barbershop',
  sortWeight: 87,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'Fade Room', tagline: 'Sharp cuts, no waiting.' },
  theme: faderoom,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Fade Room — a modern barbershop',
      description:
        'Fade Room is a fast, dialed-in barbershop for skin fades, tapers, cuts and beard work. Book your barber online in about a minute.',
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
