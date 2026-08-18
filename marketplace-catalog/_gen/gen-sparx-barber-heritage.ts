// sparx-barber-heritage — "Copper & Cole", a HERITAGE barbershop.
//
// The dark, masculine, blade-and-brass barbershop of the design research (a vintage-
// industrial shop that smells of leather and bay rum): a warm charcoal-black ground held
// dark in BOTH light and dark modes, cream/bone ink, a brass-gold primary and an oxblood
// barber-red accent, sharp low-radius chrome and a heritage serif display over a humanist
// sans. Deliberately the OPPOSITE of the editorial salon (bright warm-ivory, airy, soft) —
// same booking spine, a different business.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @wizeworks/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-barber-heritage.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-barber-heritage/**" \
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
  galleryStrip,
  photoHero,
  serviceMenu,
  splitFeature,
  STATUS_ON_DARK,
  teamRow,
  testimonial,
  type ServiceSiteSpec,
} from './service-sites/harness';

// ── Imagery (swap-ready; each id also names an entry in ASSETS) ────────────────────
const IMG = {
  hero: 'barber-heritage-hero',
  interior: 'barber-heritage-interior',
  vince: 'barber-heritage-vince',
  marcus: 'barber-heritage-marcus',
  silas: 'barber-heritage-silas',
  work1: 'barber-heritage-work1',
  work2: 'barber-heritage-work2',
  work3: 'barber-heritage-work3',
} as const;

const PHOTO: Record<string, string> = {
  "copperandcole-hero": "https://images.unsplash.com/photo-1781455793310-8427c96454c7?w=1600&q=80",
  "copperandcole-interior": "https://images.unsplash.com/photo-1573586927918-3e6476da8395?w=1600&q=80",
  "copperandcole-vince": "https://images.unsplash.com/photo-1517832606299-7ae9b720a186?w=1600&q=80",
  "copperandcole-marcus": "https://images.unsplash.com/photo-1603899968034-1a56ca48d172?w=1600&q=80",
  "copperandcole-silas": "https://images.unsplash.com/photo-1657105052497-f996284ffff8?w=1600&q=80",
  "copperandcole-work1": "https://images.unsplash.com/photo-1780688373499-c570319873a3?w=1600&q=80",
  "copperandcole-work2": "https://images.unsplash.com/photo-1621645582931-d1d3e6564943?w=1600&q=80",
  "copperandcole-work3": "https://images.unsplash.com/photo-1524230616393-d6229fcd2eff?w=1600&q=80",
};
const src = (seed: string): string =>
  PHOTO[seed] ?? `https://picsum.photos/seed/${seed}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}
const ASSETS: Asset[] = [
  { id: IMG.hero, url: src('copperandcole-hero'), alt: 'A dark, wood-and-brass barbershop with leather chairs' },
  { id: IMG.interior, url: src('copperandcole-interior'), alt: 'A barber station with a straight razor and hot towels' },
  { id: IMG.vince, url: src('copperandcole-vince'), alt: 'Vince Cole, master barber' },
  { id: IMG.marcus, url: src('copperandcole-marcus'), alt: 'Marcus Reyes, barber' },
  { id: IMG.silas, url: src('copperandcole-silas'), alt: 'Silas Cooper, barber' },
  { id: IMG.work1, url: src('copperandcole-work1'), alt: 'A clean skin fade with a sharp line-up' },
  { id: IMG.work2, url: src('copperandcole-work2'), alt: 'A shaped beard after a hot-towel finish' },
  { id: IMG.work3, url: src('copperandcole-work3'), alt: 'A classic scissor cut, tight on the sides' },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-barber-heritage: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "copperandcole": charcoal-black ground (dark in BOTH modes), brass primary,
//    oxblood accent, cream ink, sharp low-radius chrome, a heritage serif display ─────────
const copperandcole = defineTheme({
  name: 'copperandcole',
  type: { body: face('Inter', 'sans-serif'), head: face('Libre Baskerville', 'serif') },
  shape: { selector: '0.125rem', field: '0.125rem', box: '0.125rem', depth: '0' },
  light: {
    // A moody heritage shop even in "light" mode: warm charcoal-black surfaces, cream ink.
    surfaces: [
      'oklch(22% 0.012 60)', // warm charcoal-black
      'oklch(18% 0.012 55)', // deeper panel
      'oklch(32% 0.014 62)', // hairline (lifted so borders read on dark)
      'oklch(92% 0.02 85)', // cream / bone ink
    ],
    roles: {
      primary: 'oklch(72% 0.11 78)', // brass gold
      secondary: 'oklch(72% 0.04 72)', // aged brass / tan (legible on charcoal)
      accent: 'oklch(48% 0.15 25)', // oxblood / barber red
      neutral: 'oklch(80% 0.01 60)',
      ...STATUS_ON_DARK,
    },
  },
  dark: {
    // A touch darker still.
    surfaces: [
      'oklch(18% 0.012 60)',
      'oklch(15% 0.01 55)',
      'oklch(28% 0.014 62)',
      'oklch(93% 0.02 85)',
    ],
    roles: {
      primary: 'oklch(76% 0.11 80)',
      secondary: 'oklch(74% 0.04 74)',
      accent: 'oklch(55% 0.16 25)',
      neutral: 'oklch(84% 0.01 60)',
      ...STATUS_ON_DARK,
    },
  },
});
// NOTE: this theme is dark in BOTH modes (a moody heritage shop even in "light"), so both
// palettes take STATUS_ON_DARK — the on-light status set never applies here.

// ── Scheduling — the booking spine (policies, barbers + hours, the service menu) ────────
const hours = (days: number[], startMinute: number, endMinute: number) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

const SCHEDULING = {
  policies: [
    {
      handle: 'shop-standard',
      name: 'Standard booking',
      depositType: 'none',
      cancellationWindowHours: 12,
      reminderOffsetsMin: [1440, 120],
      policyText:
        'Walk in or book ahead — either works. If you booked and can’t make it, give us 12 hours so we can hand the chair to someone else. We text a reminder the day before and two hours out.',
    },
    {
      handle: 'no-show',
      name: 'Longer-chair booking',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [1440, 180, 60],
      policyText:
        'The shave and the full combo hold your barber for the better part of an hour. No deposit — just give us 24 hours if plans change. Two no-shows and we’ll ask you to call to rebook.',
    },
  ],
  resources: [
    {
      handle: 'vince',
      name: 'Vince Cole',
      kind: 'staff',
      skillTags: ['cut', 'fade', 'beard', 'shave'],
      windows: hours([2, 3, 4, 5, 6], 540, 1140), // Tue–Sat 9–7
    },
    {
      handle: 'marcus',
      name: 'Marcus Reyes',
      kind: 'staff',
      skillTags: ['cut', 'fade', 'beard', 'shave'],
      windows: hours([3, 4, 5, 6, 0], 600, 1200), // Wed–Sun 10–8
    },
    {
      handle: 'silas',
      name: 'Silas Cooper',
      kind: 'staff',
      skillTags: ['cut', 'fade', 'beard', 'shave'],
      windows: hours([2, 4, 5, 6], 480, 1080), // Tue, Thu–Sat 8–6
    },
  ],
  services: [
    {
      handle: 'haircut',
      name: 'Haircut',
      description: 'Scissor or clipper, washed and finished. A proper cut, no rush.',
      durationMinutes: 30,
      priceCents: 3500,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'barber', kind: 'staff', skillTags: ['cut'], count: 1 }],
      policyHandle: 'shop-standard',
    },
    {
      handle: 'skin-fade',
      name: 'Skin fade',
      description: 'A clean fade down to the skin with a sharp line-up. Tight and precise.',
      durationMinutes: 45,
      priceCents: 4500,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'barber', kind: 'staff', skillTags: ['fade'], count: 1 }],
      policyHandle: 'shop-standard',
    },
    {
      handle: 'beard-trim',
      name: 'Beard trim & shape',
      description: 'Line it up, shape it out, hot towel to finish. Walk-ins welcome.',
      durationMinutes: 20,
      priceCents: 2000,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'barber', kind: 'staff', skillTags: ['beard'], count: 1 }],
      policyHandle: 'shop-standard',
    },
    {
      handle: 'straight-razor-shave',
      name: 'Hot-towel straight-razor shave',
      description: 'Hot towels, a proper lather and a straight razor. The old-school shave, done right.',
      durationMinutes: 45,
      priceCents: 4500,
      bufferAfterMin: 10,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'barber', kind: 'staff', skillTags: ['shave'], count: 1 }],
      policyHandle: 'no-show',
    },
    {
      handle: 'cut-beard-combo',
      name: 'Cut + beard combo',
      description: 'A full haircut and a shaped beard in one sitting. Walk out squared away.',
      durationMinutes: 60,
      priceCents: 6000,
      bufferAfterMin: 10,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'barber', kind: 'staff', skillTags: ['cut', 'beard'], count: 1 },
      ],
      policyHandle: 'no-show',
    },
    {
      handle: 'kids-cut',
      name: 'Kids cut',
      description: 'A patient cut for the young ones, twelve and under. In and out, no fuss.',
      durationMinutes: 30,
      priceCents: 2500,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'barber', kind: 'staff', skillTags: ['cut'], count: 1 }],
      policyHandle: 'shop-standard',
    },
    {
      handle: 'buzz',
      name: 'Buzz cut',
      description: 'One length, all over, clean neckline. Quick, sharp, done.',
      durationMinutes: 20,
      priceCents: 2000,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'barber', kind: 'staff', skillTags: ['cut'], count: 1 }],
      policyHandle: 'shop-standard',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  photoHero({
    image: url(IMG.hero),
    alt: 'A dark, wood-and-brass barbershop with leather chairs',
    eyebrow: 'EST. 2014',
    title: 'A proper barbershop. Nothing less.',
    sub: 'Sharp cuts, clean fades and a hot-towel shave that takes its time. Walk in, or book your chair and your barber.',
    primary: { label: 'Book a chair', href: '/book' },
    secondary: { label: 'See the menu', href: '/book' },
    overlay: 'darker',
  }),
  featureRow({
    items: [
      {
        title: 'Walk-ins welcome',
        body: 'Got a free hour? Come in. If a chair’s open we’ll take you — no appointment needed, no attitude at the door.',
      },
      {
        title: 'Hot-towel finish',
        body: 'Every cut ends the way it should: a hot towel, a clean neckline and a face that feels fresh, not just trimmed.',
      },
      {
        title: 'The straight razor',
        body: 'We still shave with a blade and a brush. Hot lather, steady hands, and the closest shave you’ll get anywhere.',
      },
    ],
  }),
  serviceMenu({
    heading: 'The menu',
    intro: 'What we do most, with real prices. Live times and every service are on the booking page.',
    surface: 'muted',
    columns: 2,
    items: [
      { name: 'Haircut', priceCents: 3500, durationMin: 30, desc: 'Scissor or clipper, washed and finished.' },
      { name: 'Skin fade', priceCents: 4500, durationMin: 45, desc: 'Faded to the skin with a sharp line-up.' },
      { name: 'Hot-towel straight-razor shave', priceCents: 4500, durationMin: 45, desc: 'Hot towels, lather and a straight razor.' },
      { name: 'Cut + beard combo', priceCents: 6000, durationMin: 60, desc: 'Full cut and a shaped beard, one sitting.' },
    ],
    cta: { label: 'See everything & book', href: '/book' },
  }),
  splitFeature({
    image: url(IMG.interior),
    alt: 'A barber station with a straight razor and hot towels',
    heading: 'Brass, leather and a good blade',
    body: [
      'Copper & Cole has run the same way since 2014 — real barbers, real chairs, and the old tools kept sharp. No gimmicks, no rushing you out the door.',
      'You sit down, you get looked after, you leave sharper than you came in. That’s the whole job, and we take it seriously.',
    ],
    cta: { label: 'Book your chair', href: '/book' },
  }),
  teamRow({
    heading: 'Your barbers',
    intro: 'Book by name — the same hands every time, or take whoever’s open.',
    members: [
      { name: 'Vince Cole', role: 'Master barber', image: url(IMG.vince), alt: 'Vince Cole, master barber', bio: 'Founded the shop in 2014. Classic cuts and a straight-razor shave nobody beats.' },
      { name: 'Marcus Reyes', role: 'Barber', image: url(IMG.marcus), alt: 'Marcus Reyes, barber', bio: 'Fades, tapers and sharp line-ups. Fast hands, clean work.' },
      { name: 'Silas Cooper', role: 'Barber', image: url(IMG.silas), alt: 'Silas Cooper, barber', bio: 'Scissor work and beards. Takes his time, gets it right.' },
    ],
  }),
  galleryStrip({
    heading: 'From the chair',
    surface: 'muted',
    columns: 3,
    images: [
      { src: url(IMG.work1), alt: 'A clean skin fade with a sharp line-up' },
      { src: url(IMG.work2), alt: 'A shaped beard after a hot-towel finish' },
      { src: url(IMG.work3), alt: 'A classic scissor cut, tight on the sides' },
    ],
  }),
  testimonial({
    quote: 'Best cut in the city, hands down. The shave alone is worth the trip — hot towel, straight razor, the works. I don’t go anywhere else.',
    attribution: 'Dev, regular since 2018',
  }),
  bookingCta({
    title: 'Grab a chair',
    sub: 'Pick your service, pick your barber, see live times. Or just walk in — we’ll sort you out.',
    cta: { label: 'Book a chair', href: '/book' },
  }),
];

const BOOK_INTRO = [
  photoHero({
    image: url(IMG.interior),
    alt: 'A barber station with a straight razor and hot towels',
    eyebrow: 'EST. 2014',
    title: 'Book your chair',
    sub: 'Choose a service to see prices and live times, then pick your barber and your slot.',
    primary: { label: 'See services below', href: '/book' },
    overlay: 'darker',
    align: 'start',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.hero),
    alt: 'A dark, wood-and-brass barbershop with leather chairs',
    heading: 'About Copper & Cole',
    body: [
      'We opened Copper & Cole in 2014 to run a barbershop the old way — real barbers, sharp tools, and time taken over every cut and shave.',
      'No franchise script, no upsell, no ten-minute turnaround. Just good work done properly, for men who want to look after themselves.',
    ],
    cta: { label: 'Book a chair', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'How the shop runs',
    items: [
      { title: 'Walk in or book', body: 'A chair’s a chair. Book ahead and it’s yours, or walk in and we’ll take you as soon as one opens.' },
      { title: 'The tools kept sharp', body: 'Clippers, shears and a straight razor, all maintained the way they should be. It shows in the finish.' },
      { title: 'Same barber, every time', body: 'Find the one who gets your cut and book them by name. They’ll know your head before you sit down.' },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Find the shop',
    address: ['Copper & Cole', '412 Ironside Avenue', 'Portland, OR 97214'],
    mapLocation: '412 Ironside Avenue, Portland, OR 97214',
    hours: [
      { day: 'Tuesday – Friday', time: '9:00 – 7:00' },
      { day: 'Saturday', time: '8:00 – 6:00' },
      { day: 'Sunday', time: '10:00 – 4:00' },
      { day: 'Monday', time: 'Closed' },
    ],
  }),
  bookingCta({
    title: 'Skip the wait',
    sub: 'Book your chair online and see live times — walk-ins still welcome whenever a chair’s open.',
    surface: 'muted',
    cta: { label: 'Book a chair', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-barber-heritage',
  name: 'Barbershop (Heritage)',
  summary:
    'A dark, masculine heritage-barbershop site — a warm charcoal-black palette, a brass-gold primary, an oxblood accent and a heritage serif over sharp, low-radius chrome. Installs a working booking flow: a real menu (cuts, skin fades, beard work, a hot-towel straight-razor shave), three barbers you book by name with their own hours, and walk-in-friendly no-deposit policies. Ships as "Copper & Cole", a shop running the old way since 2014.',
  tagline: 'A dark, heritage template for barbershops — book online from day one.',
  industry: 'Barbershop',
  sortWeight: 88,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'Copper & Cole', tagline: 'A proper barbershop, run the old way.' },
  theme: copperandcole,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Copper & Cole — a heritage barbershop',
      description:
        'Copper & Cole is a heritage barbershop for sharp cuts, clean skin fades, beard work and a hot-towel straight-razor shave. Walk in or book your barber online.',
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
