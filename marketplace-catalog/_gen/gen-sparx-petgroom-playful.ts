// sparx-petgroom-playful — "Scrub & Wag", a friendly neighborhood DOG GROOMING shop.
//
// The bright, cheerful, family one: bath & brush, full grooms, a puppy's-first-groom,
// de-shed treatments and nail trims, priced BY DOG SIZE. Fear-free, gentle, unhurried —
// "gentle hands, happy tails." A sky-teal primary, a sunny-yellow accent and a warm
// off-white ground, on rounded, friendly faces (Quicksand over Nunito). Deliberately the
// OPPOSITE of the upscale boutique pet spa sibling (dark, hushed, luxury): this one is
// loud, warm and made for the whole family and their dog — same booking spine, a very
// different business.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-petgroom-playful.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-petgroom-playful/**" \
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
  hero: 'petgroom-playful-hero',
  interior: 'petgroom-playful-interior',
  rosa: 'petgroom-playful-rosa',
  theo: 'petgroom-playful-theo',
  bea: 'petgroom-playful-bea',
  work1: 'petgroom-playful-work1',
  work2: 'petgroom-playful-work2',
  work3: 'petgroom-playful-work3',
} as const;

const PHOTO: Record<string, string> = {
  "scrubwag-hero": "https://images.unsplash.com/photo-1719464454959-9cf304ef4774?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8aGFwcHklMjBkb2clMjBncm9vbWluZ3xlbnwwfDB8fHwxNzg2Mzg3NDgyfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "scrubwag-rosa": "https://images.unsplash.com/photo-1579119134757-5c38803f34fc?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjB3aXRoJTIwZG9nJTIwcG9ydHJhaXR8ZW58MHwwfHx8MTc4NjM4NzQ4N3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "scrubwag-theo": "https://images.unsplash.com/photo-1529511026851-6fe7f6c908a3?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bWFuJTIwd2l0aCUyMGRvZyUyMHBvcnRyYWl0fGVufDB8MHx8fDE3ODYzODc0OTB8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "scrubwag-bea": "https://images.unsplash.com/photo-1611173622933-91942d394b04?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZG9nJTIwZ3Jvb21lciUyMHdvcmtpbmd8ZW58MHwwfHx8MTc4NjM4NzQ5M3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "scrubwag-work1": "https://images.unsplash.com/photo-1558236714-d1a6333fce68?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Z3Jvb21lZCUyMGRvZyUyMGN1dGV8ZW58MHwwfHx8MTc4NjM4NzQ5Nnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "scrubwag-work2": "https://images.unsplash.com/photo-1611173622933-91942d394b04?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Zmx1ZmZ5JTIwZG9nJTIwY2xlYW58ZW58MHwwfHx8MTc4NjM4NzQ5OXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "scrubwag-work3": "https://images.unsplash.com/photo-1710062958147-f7d458844a3f?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c21hbGwlMjBkb2clMjBwb3J0cmFpdHxlbnwwfDB8fHwxNzg2Mzg3NTAyfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "scrubwag-interior": "https://images.unsplash.com/photo-1672426637959-49f39230ad7e?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZG9nJTIwYmF0aCUyMHdhc2h8ZW58MHwwfHx8MTc4NjM4NzU3N3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (seed: string): string =>
  PHOTO[seed] ?? `https://picsum.photos/seed/${seed}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}
const ASSETS: Asset[] = [
  { id: IMG.hero, url: src('scrubwag-hero'), alt: 'A happy, freshly-bathed dog with a big grin' },
  { id: IMG.interior, url: src('scrubwag-interior'), alt: 'A bright, cheerful grooming shop with a calm bathing station' },
  { id: IMG.rosa, url: src('scrubwag-rosa'), alt: 'Rosa Delgado, lead groomer' },
  { id: IMG.theo, url: src('scrubwag-theo'), alt: 'Theo Park, groomer and de-shed specialist' },
  { id: IMG.bea, url: src('scrubwag-bea'), alt: 'Bea Nguyen, puppy and bath groomer' },
  { id: IMG.work1, url: src('scrubwag-work1'), alt: 'A fluffy dog after a full groom, looking proud' },
  { id: IMG.work2, url: src('scrubwag-work2'), alt: 'A small dog with a fresh, tidy trim' },
  { id: IMG.work3, url: src('scrubwag-work3'), alt: 'A big smiling dog fresh from a bath and brush' },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-petgroom-playful: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "scrubwag": warm off-white ground, sky-teal primary, sunny-yellow accent ──
const scrubwag = defineTheme({
  name: 'scrubwag',
  type: { body: face('Nunito', 'sans-serif'), head: face('Quicksand', 'sans-serif') },
  shape: { selector: '0.75rem', field: '0.75rem', box: '1.5rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(98% 0.012 95)', // warm off-white
      'oklch(95% 0.018 95)', // soft cream
      'oklch(90% 0.022 95)', // hairline
      'oklch(30% 0.04 235)', // deep teal-navy ink
    ],
    roles: {
      primary: 'oklch(72% 0.13 210)', // friendly sky-teal
      secondary: 'oklch(45% 0.05 235)', // warm teal-slate
      accent: 'oklch(86% 0.15 95)', // sunny yellow
      neutral: 'oklch(32% 0.03 235)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(26% 0.03 235)',
      'oklch(22% 0.025 235)',
      'oklch(18% 0.02 235)',
      'oklch(96% 0.012 95)',
    ],
    roles: {
      primary: 'oklch(78% 0.12 210)',
      secondary: 'oklch(80% 0.04 220)',
      accent: 'oklch(88% 0.14 95)',
      neutral: 'oklch(84% 0.02 220)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the booking spine (policies, groomers + stations + hours, the menu) ──
const hours = (days: number[], startMinute: number, endMinute: number) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

const SCHEDULING = {
  policies: [
    {
      handle: 'wag-standard',
      name: 'Standard booking',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [1440, 120],
      policyText:
        'Give us at least 24 hours’ notice to change or cancel your dog’s spot. We text a reminder the day before and two hours ahead so nobody forgets bath day.',
    },
    {
      handle: 'groom-deposit',
      name: 'Full-groom deposit',
      depositType: 'deposit',
      depositAmountCents: 1500,
      cancellationWindowHours: 48,
      reminderOffsetsMin: [2880, 1440, 120],
      policyText:
        'Full grooms hold a $15 deposit that comes right off your total. Reschedule with 48 hours’ notice and it carries over — it only keeps a no-show from taking a groomer’s whole afternoon.',
    },
  ],
  resources: [
    {
      handle: 'rosa',
      name: 'Rosa Delgado',
      kind: 'staff',
      skillTags: ['bath', 'full-groom', 'hand-strip'],
      windows: hours([2, 3, 4, 5, 6], 540, 1020), // Tue–Sat 9–5
    },
    {
      handle: 'theo',
      name: 'Theo Park',
      kind: 'staff',
      skillTags: ['bath', 'full-groom', 'de-shed'],
      windows: hours([3, 4, 5, 6], 540, 1020), // Wed–Sat 9–5
    },
    {
      handle: 'bea',
      name: 'Bea Nguyen',
      kind: 'staff',
      skillTags: ['bath', 'nails', 'puppy'],
      windows: hours([2, 3, 4, 5], 570, 990), // Tue–Fri 9:30–4:30
    },
    {
      handle: 'bath-bay',
      name: 'Bath bay',
      kind: 'table',
      skillTags: ['station'],
      windows: hours([2, 3, 4, 5, 6], 540, 1020),
    },
    {
      handle: 'table-a',
      name: 'Grooming table A',
      kind: 'table',
      skillTags: ['station'],
      windows: hours([2, 3, 4, 5, 6], 540, 1020),
    },
    {
      handle: 'table-b',
      name: 'Grooming table B',
      kind: 'table',
      skillTags: ['station'],
      windows: hours([2, 3, 4, 5, 6], 540, 1020),
    },
  ],
  services: [
    {
      handle: 'bath-brush-small',
      name: 'Bath & brush — small dog',
      description:
        'A warm bath, a gentle towel-and-cage-free blow dry, a brush-out, ears and a spritz. For dogs up to about 25 lb.',
      durationMinutes: 45,
      priceCents: 4000,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'groomer', kind: 'staff', skillTags: ['bath'], count: 1 },
        { role: 'station', kind: 'table', skillTags: ['station'], count: 1 },
      ],
      policyHandle: 'wag-standard',
    },
    {
      handle: 'bath-brush-large',
      name: 'Bath & brush — large dog',
      description:
        'The same gentle bath, brush-out and cage-free dry, sized for the big kids — dogs over about 50 lb.',
      durationMinutes: 75,
      priceCents: 6500,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'groomer', kind: 'staff', skillTags: ['bath'], count: 1 },
        { role: 'station', kind: 'table', skillTags: ['station'], count: 1 },
      ],
      policyHandle: 'wag-standard',
    },
    {
      handle: 'full-groom-small',
      name: 'Full groom — small dog',
      description:
        'Bath, full haircut to the style you like, nails, ears, paw tidy and a bandana. For dogs up to about 25 lb.',
      durationMinutes: 90,
      priceCents: 7500,
      bufferAfterMin: 10,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'groomer', kind: 'staff', skillTags: ['full-groom'], count: 1 },
        { role: 'station', kind: 'table', skillTags: ['station'], count: 1 },
      ],
      policyHandle: 'groom-deposit',
    },
    {
      handle: 'full-groom-large',
      name: 'Full groom — large dog',
      description:
        'The whole works — bath, breed or freestyle cut, nails, ears and paws — for the big dogs over about 50 lb. Never rushed.',
      durationMinutes: 120,
      priceCents: 11500,
      bufferAfterMin: 15,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'groomer', kind: 'staff', skillTags: ['full-groom'], count: 1 },
        { role: 'station', kind: 'table', skillTags: ['station'], count: 1 },
      ],
      policyHandle: 'groom-deposit',
    },
    {
      handle: 'puppy-intro',
      name: 'Puppy’s first groom',
      description:
        'A short, gentle, all-treats introduction to baths, brushes and the dryer, so your puppy learns grooming is a good day. Under 6 months.',
      durationMinutes: 45,
      priceCents: 3500,
      requiresApproval: true,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'groomer', kind: 'staff', skillTags: ['puppy'], count: 1 },
        { role: 'station', kind: 'table', skillTags: ['station'], count: 1 },
      ],
      policyHandle: 'wag-standard',
    },
    {
      handle: 'deshed-treatment',
      name: 'De-shed treatment',
      description:
        'A deep bath, a shed-loosening conditioner and a thorough undercoat brush-out — the fix for tumbleweeds of fur at home.',
      durationMinutes: 90,
      priceCents: 8000,
      bufferAfterMin: 10,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'groomer', kind: 'staff', skillTags: ['de-shed'], count: 1 },
        { role: 'station', kind: 'table', skillTags: ['station'], count: 1 },
      ],
      policyHandle: 'wag-standard',
    },
    {
      handle: 'nail-trim',
      name: 'Nail trim & tidy',
      description:
        'A quick, calm nail trim with a file-smooth finish — add a teeth-brushing on the day if you like. No appointment marathon.',
      durationMinutes: 45,
      priceCents: 2000,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'groomer', kind: 'staff', skillTags: ['nails'], count: 1 },
        { role: 'station', kind: 'table', skillTags: ['station'], count: 1 },
      ],
      policyHandle: 'wag-standard',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  photoHero({
    image: url(IMG.hero),
    alt: 'A happy, freshly-bathed dog with a big grin',
    title: 'Gentle hands, happy tails',
    sub: 'A bright, fear-free neighborhood dog grooming shop — baths, full grooms and nail trims for every breed and size, done calmly and never rushed.',
    primary: { label: 'Book online', href: '/book' },
    secondary: { label: 'See the menu', href: '/book' },
    overlay: 'dark',
  }),
  featureRow({
    items: [
      {
        title: 'Fear-free, always',
        body: 'Gentle handling, lots of treats and breaks when your dog needs one. Nervous pups are our specialty, not our problem.',
      },
      {
        title: 'By appointment, so it stays calm',
        body: 'One dog at a time per groomer — no packed kennels, no barking chaos. Your dog gets our full attention.',
      },
      {
        title: 'All breeds & sizes',
        body: 'Chihuahua to Great Dane, doodle to double-coat — every dog is welcome and priced fairly by size.',
      },
      {
        title: 'Cage-free drying',
        body: 'No hot box dryers. We hand-dry and towel off, so your dog goes home fluffy, comfy and stress-free.',
      },
    ],
  }),
  serviceMenu({
    heading: 'Our menu',
    intro: 'Priced by your dog’s size, because a Yorkie and a Newfoundland are not the same afternoon. Full prices and live openings are on the booking page.',
    surface: 'muted',
    columns: 2,
    items: [
      { name: 'Bath & brush — small', priceCents: 4000, durationMin: 45, desc: 'Warm bath, brush-out and cage-free dry.' },
      { name: 'Full groom — small', priceCents: 7500, durationMin: 90, desc: 'Bath, haircut, nails, ears and a bandana.' },
      { name: 'Full groom — large', priceCents: 11500, durationMin: 120, desc: 'The whole works for the big kids.' },
      { name: 'De-shed treatment', priceCents: 8000, durationMin: 90, desc: 'Deep bath and undercoat blow-out.' },
      { name: 'Puppy’s first groom', priceCents: 3500, durationMin: 45, desc: 'A gentle, all-treats introduction.' },
      { name: 'Nail trim & tidy', priceCents: 2000, durationMin: 45, desc: 'Quick, calm nails with a smooth finish.' },
    ],
    cta: { label: 'See everything & book', href: '/book' },
  }),
  splitFeature({
    image: url(IMG.interior),
    alt: 'A bright, cheerful grooming shop with a calm bathing station',
    heading: 'A calm day, start to finish',
    body: [
      'Scrub & Wag is a small shop on purpose. We book one dog at a time per groomer, so there’s no crate stacking, no waiting all day, and no rush to get to the next appointment.',
      'Drop off, grab a coffee, and come back to a happy, clean dog who actually had a nice morning. That’s the whole idea.',
    ],
    cta: { label: 'Book your dog in', href: '/book' },
  }),
  teamRow({
    heading: 'Meet the groomers',
    intro: 'Book by name — your dog gets to know the same friendly face each visit.',
    members: [
      { name: 'Rosa Delgado', role: 'Lead groomer', image: url(IMG.rosa), alt: 'Rosa Delgado, lead groomer', bio: 'Full grooms and hand-stripping for wire coats. Rosa runs the shop and loves a good doodle.' },
      { name: 'Theo Park', role: 'Groomer · de-shed specialist', image: url(IMG.theo), alt: 'Theo Park, groomer and de-shed specialist', bio: 'The double-coat whisperer — huskies, shepherds and shedders of all kinds.' },
      { name: 'Bea Nguyen', role: 'Puppy & bath groomer', image: url(IMG.bea), alt: 'Bea Nguyen, puppy and bath groomer', bio: 'Endless patience for first-timers and nervous pups. Baths, nails and puppy introductions.' },
    ],
  }),
  galleryStrip({
    heading: 'Fresh & fluffy',
    surface: 'muted',
    columns: 3,
    images: [
      { src: url(IMG.work1), alt: 'A fluffy dog after a full groom, looking proud' },
      { src: url(IMG.work2), alt: 'A small dog with a fresh, tidy trim' },
      { src: url(IMG.work3), alt: 'A big smiling dog fresh from a bath and brush' },
    ],
  }),
  testimonial({
    quote: 'My rescue used to shake the whole drive to the groomer. Now she drags me to the door. Whatever they do here, it works.',
    attribution: 'Marcus & Poppy, regulars since 2024',
  }),
  bookingCta({
    title: 'Ready for a happy, clean dog?',
    sub: 'Pick a service, choose your groomer and see live openings. It takes about a minute.',
    cta: { label: 'Book online', href: '/book' },
  }),
];

const BOOK_INTRO = [
  photoHero({
    image: url(IMG.interior),
    alt: 'A bright, cheerful grooming shop with a calm bathing station',
    title: 'Book your dog’s spot',
    sub: 'Choose a service to see prices by size and live openings, then pick your groomer and time.',
    primary: { label: 'See services below', href: '/book' },
    overlay: 'darker',
    align: 'start',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.hero),
    alt: 'A happy, freshly-bathed dog with a big grin',
    heading: 'About Scrub & Wag',
    body: [
      'We started Scrub & Wag because grooming shouldn’t be a scary day. Too many places pack dogs into crates, rush them through, and hand back a stressed pup. We wanted the opposite.',
      'So we keep it small, gentle and unhurried — fear-free handling, cage-free drying, and one dog at a time per groomer. Just clean, happy dogs and owners who trust us with them.',
    ],
    cta: { label: 'Book a groom', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'How we do things',
    items: [
      { title: 'Fear-free handling', body: 'Treats, patience and breaks when your dog needs them. We go at your dog’s pace, not a timer’s.' },
      { title: 'Fair, by-size pricing', body: 'No mystery add-ons. You’ll know the price for your dog’s size before you book, and it’s the price you pay.' },
      { title: 'You’ll always know', body: 'We tell you exactly what your dog got, flag anything we noticed on their skin or coat, and show you how to keep them comfy between visits.' },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Come say hi',
    address: ['Scrub & Wag', '54 Maple Row', 'Bellingham, WA 98225'],
    mapLocation: '54 Maple Row, Bellingham, WA 98225',
    hours: [
      { day: 'Tuesday – Friday', time: '9:00 – 5:00' },
      { day: 'Saturday', time: '9:00 – 5:00' },
      { day: 'Sunday – Monday', time: 'Closed' },
    ],
  }),
  bookingCta({
    title: 'Rather book than call?',
    sub: 'See live openings and grab your dog’s spot online — no phone tag, no hold music.',
    surface: 'muted',
    cta: { label: 'Book online', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-petgroom-playful',
  name: 'Pet Grooming (Playful)',
  summary:
    'A bright, friendly dog-grooming site — a sky-teal primary, a sunny-yellow accent and a warm off-white ground on rounded, cheerful faces. Installs a working booking flow: a real menu priced by dog size (bath & brush, full groom, puppy intro, de-shed, nail trim), three groomers you book by name plus three grooming stations as bookable resources, and a $15 full-groom deposit policy. Ships as "Scrub & Wag".',
  tagline: 'A bright, playful template for dog groomers — book online from day one.',
  industry: 'Pet grooming',
  sortWeight: 80,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'Scrub & Wag', tagline: 'Gentle hands, happy tails.' },
  theme: scrubwag,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Scrub & Wag — friendly dog grooming',
      description:
        'Scrub & Wag is a bright, fear-free dog grooming shop. Baths, full grooms, de-shed treatments and nail trims priced by size. Book your groomer online.',
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
