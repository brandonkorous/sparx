// sparx-nail-luxe — "Gilded", a LUXE, quiet nail studio.
//
// The warm, calm, upscale nail room — champagne ground, a soft-gold primary, a
// high-contrast serif display over a humanist sans, and unhurried, spacious photography.
// Deliberately the OPPOSITE of the gallery-chic nail studio (bright/coral/grotesque):
// this one is warm, hushed and considered — a spa-quiet room, not a loud gallery. Same
// booking spine as the salon templates, a different business.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-nail-luxe.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-nail-luxe/**" \
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
  hero: 'nail-luxe-hero',
  interior: 'nail-luxe-interior',
  elena: 'nail-luxe-elena',
  sofia: 'nail-luxe-sofia',
  camille: 'nail-luxe-camille',
  work1: 'nail-luxe-work1',
  work2: 'nail-luxe-work2',
  work3: 'nail-luxe-work3',
} as const;

// Seed-addressed imagery. `src(seed)` returns a mapped photo when one is registered and a
// deterministic seeded fallback otherwise — so the bundle previews cleanly and a tenant
// swaps each image in the builder later.
const PHOTO: Record<string, string> = {
  "gilded-hero": "https://images.unsplash.com/photo-1652869122685-c7792ef56ee2?w=1600&q=80",
  "gilded-interior": "https://images.unsplash.com/photo-1610992015836-7c249d75782d?w=1600&q=80",
  "gilded-elena": "https://images.unsplash.com/photo-1666226398826-5b7ae0111e9a?w=1600&q=80",
  "gilded-sofia": "https://images.unsplash.com/photo-1699669646912-1593955f4424?w=1600&q=80",
  "gilded-camille": "https://images.unsplash.com/photo-1522337660859-02fbefca4702?w=1600&q=80",
  "gilded-work1": "https://images.unsplash.com/photo-1628610726537-6e9d2799f871?w=1600&q=80",
  "gilded-work2": "https://images.unsplash.com/photo-1740138160889-29d711607d71?w=1600&q=80",
  "gilded-work3": "https://images.unsplash.com/photo-1585525975637-f32a3d2c2209?w=1600&q=80",
};
const src = (seed: string): string =>
  PHOTO[seed] ?? `https://picsum.photos/seed/${seed}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}
const ASSETS: Asset[] = [
  { id: IMG.hero, url: src('gilded-hero'), alt: 'A calm, champagne-toned nail studio in soft light' },
  { id: IMG.interior, url: src('gilded-interior'), alt: 'A single manicure table with warm natural light' },
  { id: IMG.elena, url: src('gilded-elena'), alt: 'Elena Marchetti, lead nail technician' },
  { id: IMG.sofia, url: src('gilded-sofia'), alt: 'Sofia Reyes, nail technician' },
  { id: IMG.camille, url: src('gilded-camille'), alt: 'Camille Laurent, gel and nail-art specialist' },
  { id: IMG.work1, url: src('gilded-work1'), alt: 'A soft, glossy nude manicure' },
  { id: IMG.work2, url: src('gilded-work2'), alt: 'A quiet French finish with a champagne tint' },
  { id: IMG.work3, url: src('gilded-work3'), alt: 'Delicate, hand-painted nail art in warm gold' },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-nail-luxe: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "gilded": champagne ground, soft-gold primary, dusty-rose accent, serif display ─
const gilded = defineTheme({
  name: 'gilded',
  type: { body: face('Inter', 'sans-serif'), head: face('Cormorant Garamond', 'serif') },
  shape: { selector: '0.5rem', field: '0.5rem', box: '0.5rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(97% 0.012 92)', // warm ivory / champagne
      'oklch(94% 0.018 88)', // champagne
      'oklch(89% 0.02 85)', // warm hairline
      'oklch(28% 0.014 70)', // warm charcoal ink
    ],
    roles: {
      primary: 'oklch(66% 0.07 82)', // soft gold
      secondary: 'oklch(44% 0.014 65)', // warm charcoal
      accent: 'oklch(72% 0.06 20)', // dusty rose
      neutral: 'oklch(30% 0.012 70)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(24% 0.012 70)',
      'oklch(20% 0.01 70)',
      'oklch(16% 0.008 70)',
      'oklch(95% 0.012 90)',
    ],
    roles: {
      primary: 'oklch(78% 0.08 84)',
      secondary: 'oklch(76% 0.014 75)',
      accent: 'oklch(78% 0.06 22)',
      neutral: 'oklch(84% 0.012 75)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the booking spine (policies, techs + chairs + hours, the service menu) ─
const hours = (days: number[], startMinute: number, endMinute: number) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

// Studio opening windows: Tue–Fri 10–7, Sat 9–6, Sun 11–5 (Mon closed).
const OPEN = [
  ...hours([2, 3, 4, 5], 600, 1140),
  ...hours([6], 540, 1080),
  ...hours([0], 660, 1020),
];

const SCHEDULING = {
  policies: [
    {
      handle: 'nail-standard',
      name: 'Standard booking',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [1440, 120],
      policyText:
        'Please give us at least 24 hours’ notice to change or cancel. We send a gentle reminder the day before and two hours ahead.',
    },
    {
      handle: 'extension-deposit',
      name: 'Extension deposit',
      depositType: 'deposit',
      depositAmountCents: 2000,
      cancellationWindowHours: 48,
      reminderOffsetsMin: [2880, 1440, 120],
      policyText:
        'Extension appointments hold a small $20 deposit that comes off your total. Reschedule with 48 hours’ notice and it carries over.',
    },
  ],
  resources: [
    {
      handle: 'elena',
      name: 'Elena Marchetti',
      kind: 'staff',
      skillTags: ['manicure', 'gel', 'pedicure', 'extensions', 'nailart', 'removal'],
      windows: [...hours([2, 3, 4, 5], 600, 1140), ...hours([6], 540, 1080)], // Tue–Sat
    },
    {
      handle: 'sofia',
      name: 'Sofia Reyes',
      kind: 'staff',
      skillTags: ['manicure', 'gel', 'pedicure', 'removal'],
      windows: [...hours([3, 4, 5], 600, 1140), ...hours([6], 540, 1080), ...hours([0], 660, 1020)], // Wed–Sun
    },
    {
      handle: 'camille',
      name: 'Camille Laurent',
      kind: 'staff',
      skillTags: ['manicure', 'gel', 'extensions', 'nailart', 'removal'],
      windows: [...hours([2, 4, 5], 600, 1140), ...hours([6], 540, 1080)], // Tue, Thu, Fri, Sat
    },
    {
      handle: 'pedi-chair-1',
      name: 'Pedicure chair 1',
      kind: 'space',
      skillTags: ['pedicure'],
      windows: OPEN,
    },
    {
      handle: 'pedi-chair-2',
      name: 'Pedicure chair 2',
      kind: 'space',
      skillTags: ['pedicure'],
      windows: OPEN,
    },
  ],
  services: [
    {
      handle: 'luxury-manicure',
      name: 'Luxury manicure',
      description: 'A soak, a considered shape, cuticle care, a warm hand massage and a flawless polish.',
      durationMinutes: 45,
      priceCents: 5500,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'technician', kind: 'staff', skillTags: ['manicure'], count: 1 },
      ],
      policyHandle: 'nail-standard',
    },
    {
      handle: 'gel-manicure',
      name: 'Gel manicure',
      description: 'A long-wearing gel finish — high-gloss, chip-free and set to last a fortnight.',
      durationMinutes: 60,
      priceCents: 7000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'technician', kind: 'staff', skillTags: ['gel'], count: 1 }],
      policyHandle: 'nail-standard',
    },
    {
      handle: 'spa-pedicure',
      name: 'Spa pedicure',
      description: 'A warm soak, a full smoothing, cuticle work and polish in a quiet pedicure chair.',
      durationMinutes: 60,
      priceCents: 7500,
      bufferAfterMin: 10,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'technician', kind: 'staff', skillTags: ['pedicure'], count: 1 },
        { role: 'chair', kind: 'space', skillTags: ['pedicure'], count: 1 },
      ],
      policyHandle: 'nail-standard',
    },
    {
      handle: 'deluxe-spa-pedicure',
      name: 'Deluxe spa pedicure',
      description: 'The spa pedicure, unhurried — with an extended lower-leg and foot massage to finish.',
      durationMinutes: 90,
      priceCents: 11000,
      bufferAfterMin: 15,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'technician', kind: 'staff', skillTags: ['pedicure'], count: 1 },
        { role: 'chair', kind: 'space', skillTags: ['pedicure'], count: 1 },
      ],
      policyHandle: 'nail-standard',
    },
    {
      handle: 'gel-extensions',
      name: 'Gel extensions',
      description: 'Hand-built gel extensions, sculpted to your length and shape for a natural, lasting finish.',
      durationMinutes: 120,
      priceCents: 12000,
      bufferAfterMin: 15,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'technician', kind: 'staff', skillTags: ['extensions'], count: 1 },
      ],
      policyHandle: 'extension-deposit',
    },
    {
      handle: 'nail-art',
      name: 'Nail art',
      description: 'Bespoke, hand-painted detail — a quiet accent or a full set, designed with you.',
      durationMinutes: 45,
      priceCents: 4000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'technician', kind: 'staff', skillTags: ['nailart'], count: 1 },
      ],
      policyHandle: 'nail-standard',
    },
    {
      handle: 'soak-off-removal',
      name: 'Soak-off & removal',
      description: 'Gentle, careful removal of gel or extensions that leaves the natural nail conditioned.',
      durationMinutes: 30,
      priceCents: 2500,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'technician', kind: 'staff', skillTags: ['removal'], count: 1 },
      ],
      policyHandle: 'nail-standard',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  photoHero({
    image: url(IMG.hero),
    alt: 'A calm, champagne-toned nail studio in soft light',
    title: 'Quiet luxury, at your fingertips',
    sub: 'A hushed champagne studio for considered manicures, spa pedicures and softly gilded nail art — unhurried, and entirely yours.',
    primary: { label: 'Book online', href: '/book' },
    secondary: { label: 'See the menu', href: '/book' },
    overlay: 'dark',
  }),
  featureRow({
    items: [
      {
        title: 'A studio, not a salon floor',
        body: 'A few tables, softly lit and calm. No queue, no noise — just a quiet room that feels like a small reset.',
      },
      {
        title: 'Time to do it properly',
        body: 'We never double-book a chair. Your technician takes the time your hands deserve, from soak to final gloss.',
      },
      {
        title: 'Finishes that last',
        body: 'Gentle, salon-grade gels and care, applied with real precision — so your nails still look considered two weeks on.',
      },
    ],
  }),
  serviceMenu({
    heading: 'The menu',
    intro: 'A few of the things we do most. Full prices and live availability are on the booking page.',
    surface: 'muted',
    columns: 2,
    items: [
      { name: 'Luxury manicure', priceCents: 5500, durationMin: 45, desc: 'Soak, shape, cuticle care and a flawless polish.' },
      { name: 'Gel manicure', priceCents: 7000, durationMin: 60, desc: 'A high-gloss gel finish set to last a fortnight.' },
      { name: 'Spa pedicure', priceCents: 7500, durationMin: 60, desc: 'A warm soak and full smoothing in a quiet chair.' },
      { name: 'Gel extensions', priceCents: 12000, durationMin: 120, desc: 'Hand-sculpted length, shaped to you.' },
    ],
    cta: { label: 'See everything & book', href: '/book' },
  }),
  splitFeature({
    image: url(IMG.interior),
    alt: 'A single manicure table with warm natural light',
    heading: 'Considered, unhurried, yours',
    body: [
      'Gilded is a small studio by design — a handful of tables and two quiet pedicure chairs, kept calm on purpose so every appointment gets real attention and a proper finish.',
      'That’s the whole idea: fewer people, more care, and hands you’re happy to show off long after you’ve left.',
    ],
    cta: { label: 'Book your table', href: '/book' },
  }),
  teamRow({
    heading: 'Who you’ll sit with',
    intro: 'Book by name — you’ll see the same technician each time.',
    members: [
      { name: 'Elena Marchetti', role: 'Lead technician', image: url(IMG.elena), alt: 'Elena Marchetti, lead nail technician', bio: 'Precise manicures and quiet-luxury finishes. Elena leads the studio.' },
      { name: 'Sofia Reyes', role: 'Nail technician', image: url(IMG.sofia), alt: 'Sofia Reyes, nail technician', bio: 'Spa pedicures and the softest, longest-wearing gels.' },
      { name: 'Camille Laurent', role: 'Gel & nail-art specialist', image: url(IMG.camille), alt: 'Camille Laurent, gel and nail-art specialist', bio: 'Sculpted extensions and delicate, hand-painted detail.' },
    ],
  }),
  galleryStrip({
    heading: 'Recent work',
    surface: 'muted',
    columns: 3,
    images: [
      { src: url(IMG.work1), alt: 'A soft, glossy nude manicure' },
      { src: url(IMG.work2), alt: 'A quiet French finish with a champagne tint' },
      { src: url(IMG.work3), alt: 'Delicate, hand-painted nail art in warm gold' },
    ],
  }),
  testimonial({
    quote: 'It feels less like an appointment and more like an hour off. My nails have never looked this quietly expensive.',
    attribution: 'Amara, client since 2023',
  }),
  bookingCta({
    title: 'Ready when you are',
    sub: 'Pick a service, choose your technician and see live times. It takes about a minute.',
    cta: { label: 'Book online', href: '/book' },
  }),
];

const BOOK_INTRO = [
  photoHero({
    image: url(IMG.interior),
    alt: 'A single manicure table with warm natural light',
    title: 'Book your appointment',
    sub: 'Choose a service to see prices and live availability, then pick your technician and time.',
    primary: { label: 'See services below', href: '/book' },
    overlay: 'darker',
    align: 'start',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.hero),
    alt: 'A calm, champagne-toned nail studio in soft light',
    heading: 'About Gilded',
    body: [
      'We opened Gilded to do nails the way we always wished it were done — slowly, quietly, and with a technician who remembers your hands.',
      'No rushing, no upselling, no leaving with a finish you can’t live with. Just considered manicures, warm spa pedicures and a calm hour that’s genuinely yours.',
    ],
    cta: { label: 'Book a table', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'How we work',
    items: [
      { title: 'A consultation first', body: 'Every appointment starts with a real look at your nails, your routine and the finish you actually want.' },
      { title: 'Products we believe in', body: 'Gentle, salon-grade gels and care — and honest advice on the short list of things worth taking home.' },
      { title: 'Kind to your natural nail', body: 'Careful application and gentle removal, so your nails stay healthy between visits, not just polished.' },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Visit the studio',
    address: ['Gilded', '46 Camden Row', 'Suite 3 · Charleston, SC 29401'],
    mapLocation: '46 Camden Row, Charleston, SC 29401',
    hours: [
      { day: 'Tuesday – Friday', time: '10:00 – 7:00' },
      { day: 'Saturday', time: '9:00 – 6:00' },
      { day: 'Sunday', time: '11:00 – 5:00' },
      { day: 'Monday', time: 'Closed' },
    ],
  }),
  bookingCta({
    title: 'Rather book than call?',
    sub: 'See live availability and reserve your time online — no phone tag.',
    surface: 'muted',
    cta: { label: 'Book online', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-nail-luxe',
  name: 'sparx — Nail Studio (Luxe)',
  summary:
    'A quiet, upscale nail-studio site — a warm champagne palette, a soft-gold primary and a Cormorant Garamond serif over Inter, with calm, spacious photography. Installs a working booking flow: a real service menu (luxury and gel manicures, spa pedicures, gel extensions, nail art), three technicians you book by name with their own hours, two pedicure chairs, and a small deposit on extensions. Ships as "Gilded", a calm, considered studio.',
  tagline: 'A warm, quiet template for nail studios — book online from day one.',
  industry: 'Nail studio',
  sortWeight: 83,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'Gilded', tagline: 'Quiet luxury, at your fingertips.' },
  theme: gilded,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Gilded — a luxe nail studio',
      description:
        'Gilded is a calm, upscale nail studio for luxury manicures, spa pedicures, gel extensions and bespoke nail art. Book your technician online.',
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
