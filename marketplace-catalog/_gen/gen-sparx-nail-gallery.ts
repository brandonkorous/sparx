// sparx-nail-gallery — "Lacquer", a modern, gallery-chic NAIL STUDIO.
//
// The Paintbox / Base Coat lane: a neutral gallery FRAME where the nail-art COLOUR is the
// only loud thing on the page. Editorial, precise, clean-beauty — deliberately NOT sugary
// pink. A gallery-cream ground, warm near-black ink, a coral-rose primary and a deep-teal
// accent under a clean grotesque display. Same booking spine as the salon templates — a
// real service menu, techs you book by name, and two shared nail STATIONS a manicure
// consumes alongside its tech — a different business, a gallery-forward beat order.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-nail-gallery.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-nail-gallery/**" \
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
  hero: 'nail-gallery-hero',
  interior: 'nail-gallery-interior',
  lena: 'nail-gallery-lena',
  cai: 'nail-gallery-cai',
  rosa: 'nail-gallery-rosa',
  work1: 'nail-gallery-work1',
  work2: 'nail-gallery-work2',
  work3: 'nail-gallery-work3',
  work4: 'nail-gallery-work4',
  work5: 'nail-gallery-work5',
  work6: 'nail-gallery-work6',
  work7: 'nail-gallery-work7',
  work8: 'nail-gallery-work8',
} as const;

// Every seed resolves to a stable picsum photograph — swap a seed for a curated URL later
// without touching a call site.
const PHOTO: Record<string, string> = {
  "lacquer-hero": "https://images.unsplash.com/photo-1594243004281-f0038f833026?w=1600&q=80",
  "lacquer-interior": "https://images.unsplash.com/photo-1613457492120-4fcfbb7c3a5b?w=1600&q=80",
  "lacquer-lena": "https://images.unsplash.com/photo-1632345031435-8727f6897d53?w=1600&q=80",
  "lacquer-cai": "https://images.unsplash.com/photo-1693776529070-2cdea397595b?w=1600&q=80",
  "lacquer-rosa": "https://images.unsplash.com/photo-1693776575284-64b0d451c640?w=1600&q=80",
  "lacquer-work1": "https://images.unsplash.com/photo-1771441580033-3979bc33627b?w=1600&q=80",
  "lacquer-work2": "https://images.unsplash.com/photo-1572743686183-729b40b9230e?w=1600&q=80",
  "lacquer-work3": "https://images.unsplash.com/photo-1610992015732-2449b76344bc?w=1600&q=80",
  "lacquer-work4": "https://images.unsplash.com/photo-1771441580033-3979bc33627b?w=1600&q=80",
  "lacquer-work5": "https://images.unsplash.com/photo-1572743686183-729b40b9230e?w=1600&q=80",
  "lacquer-work6": "https://images.unsplash.com/photo-1610992015732-2449b76344bc?w=1600&q=80",
  "lacquer-work7": "https://images.unsplash.com/photo-1771441580033-3979bc33627b?w=1600&q=80",
  "lacquer-work8": "https://images.unsplash.com/photo-1572743686183-729b40b9230e?w=1600&q=80",
};
const src = (seed: string): string =>
  PHOTO[seed] ?? `https://picsum.photos/seed/${seed}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}
const ASSETS: Asset[] = [
  { id: IMG.hero, url: src('lacquer-hero'), alt: 'A calm, gallery-white nail studio with a single coral chair' },
  { id: IMG.interior, url: src('lacquer-interior'), alt: 'A minimal manicure station in warm daylight' },
  { id: IMG.lena, url: src('lacquer-lena'), alt: 'Lena Ohno, lead nail artist' },
  { id: IMG.cai, url: src('lacquer-cai'), alt: 'Cai Fontaine, nail technician' },
  { id: IMG.rosa, url: src('lacquer-rosa'), alt: 'Rosa Márquez, nail artist' },
  { id: IMG.work1, url: src('lacquer-work1'), alt: 'A glossy coral-rose gel set' },
  { id: IMG.work2, url: src('lacquer-work2'), alt: 'A minimal negative-space manicure' },
  { id: IMG.work3, url: src('lacquer-work3'), alt: 'Fine-line hand-painted nail art' },
  { id: IMG.work4, url: src('lacquer-work4'), alt: 'A sheer, clean-beauty natural finish' },
  { id: IMG.work5, url: src('lacquer-work5'), alt: 'A deep-teal chrome accent nail' },
  { id: IMG.work6, url: src('lacquer-work6'), alt: 'A soft, sculpted builder-gel set' },
  { id: IMG.work7, url: src('lacquer-work7'), alt: 'A precise french with a modern tip' },
  { id: IMG.work8, url: src('lacquer-work8'), alt: 'A matte micro-art detail on short nails' },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-nail-gallery: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "lacquer": gallery-cream ground, warm near-black ink, coral-rose primary, ──
//    deep-teal accent, clean grotesque display over a humanist sans, low radius, flat.
const lacquer = defineTheme({
  name: 'lacquer',
  type: { body: face('Inter', 'sans-serif'), head: face('Space Grotesk', 'sans-serif') },
  shape: { selector: '0.25rem', field: '0.25rem', box: '0.25rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(97% 0.004 90)', // gallery cream / off-white ground
      'oklch(94% 0.006 88)', // soft cream elevation
      'oklch(89% 0.008 85)', // hairline
      'oklch(22% 0.01 40)', // warm near-black ink
    ],
    roles: {
      primary: 'oklch(70% 0.12 25)', // coral-rose
      secondary: 'oklch(42% 0.012 40)', // warm charcoal
      accent: 'oklch(55% 0.09 210)', // deep teal
      neutral: 'oklch(26% 0.01 40)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(21% 0.01 40)',
      'oklch(17% 0.008 40)',
      'oklch(14% 0.006 40)',
      'oklch(95% 0.004 90)',
    ],
    roles: {
      primary: 'oklch(74% 0.11 25)', // coral-rose, lifted for dark
      secondary: 'oklch(74% 0.012 60)',
      accent: 'oklch(70% 0.08 210)', // deep teal, lifted
      neutral: 'oklch(82% 0.01 70)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the booking spine (a standard policy, three techs + two shared nail ──
//    STATIONS, and the service menu). A manicure/art service consumes a tech AND a table;
//    a pedicure needs only its tech.
const hours = (days: number[], startMinute: number, endMinute: number) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

// Studio hours: Tue–Fri 10–7, Sat 9–6, Sun 11–4, Mon closed. Stations are open the full
// week the studio is; each tech works a subset.
const STATION_WINDOWS = [
  ...hours([2, 3, 4, 5], 600, 1140), // Tue–Fri 10–7
  ...hours([6], 540, 1080), // Sat 9–6
  ...hours([0], 660, 960), // Sun 11–4
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
        'Please give us at least 24 hours’ notice to change or cancel. We send a reminder the day before and two hours ahead.',
    },
  ],
  resources: [
    {
      handle: 'lena',
      name: 'Lena Ohno',
      kind: 'staff',
      skillTags: ['manicure', 'gel', 'art', 'pedicure'],
      windows: [...hours([2, 3, 4, 5], 600, 1140), ...hours([6], 540, 1080)], // Tue–Sat
    },
    {
      handle: 'cai',
      name: 'Cai Fontaine',
      kind: 'staff',
      skillTags: ['manicure', 'gel', 'pedicure'],
      windows: [...hours([3, 4, 5], 600, 1140), ...hours([6], 540, 1080), ...hours([0], 660, 960)], // Wed–Sat, Sun
    },
    {
      handle: 'rosa',
      name: 'Rosa Márquez',
      kind: 'staff',
      skillTags: ['manicure', 'gel', 'art'],
      windows: [...hours([2, 4, 5], 600, 1140), ...hours([0], 660, 960)], // Tue, Thu, Fri, Sun
    },
    {
      handle: 'station-one',
      name: 'Station One',
      kind: 'table',
      skillTags: [],
      windows: STATION_WINDOWS,
    },
    {
      handle: 'station-two',
      name: 'Station Two',
      kind: 'table',
      skillTags: [],
      windows: STATION_WINDOWS,
    },
  ],
  services: [
    {
      handle: 'classic-manicure',
      name: 'Classic manicure',
      description: 'A shape, tidy cuticles, a nourishing treatment and a flawless polish.',
      durationMinutes: 30,
      priceCents: 3500,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'tech', kind: 'staff', skillTags: ['manicure'], count: 1 },
        { role: 'station', kind: 'table', skillTags: [], count: 1 },
      ],
      policyHandle: 'nail-standard',
    },
    {
      handle: 'gel-manicure',
      name: 'Gel manicure',
      description: 'A long-wear gel colour, cured to a high-gloss finish that lasts two weeks plus.',
      durationMinutes: 45,
      priceCents: 5000,
      bufferAfterMin: 5,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'tech', kind: 'staff', skillTags: ['gel'], count: 1 },
        { role: 'station', kind: 'table', skillTags: [], count: 1 },
      ],
      policyHandle: 'nail-standard',
    },
    {
      handle: 'builder-gel',
      name: 'Builder-gel set',
      description: 'A sculpted overlay for length and strength on your own nails — subtle, natural, sturdy.',
      durationMinutes: 75,
      priceCents: 7500,
      bufferAfterMin: 10,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'tech', kind: 'staff', skillTags: ['gel'], count: 1 },
        { role: 'station', kind: 'table', skillTags: [], count: 1 },
      ],
      policyHandle: 'nail-standard',
    },
    {
      handle: 'classic-pedicure',
      name: 'Classic pedicure',
      description: 'A soak, shape and smooth, a light massage and a polished finish.',
      durationMinutes: 45,
      priceCents: 5500,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'tech', kind: 'staff', skillTags: ['pedicure'], count: 1 }],
      policyHandle: 'nail-standard',
    },
    {
      handle: 'gel-pedicure',
      name: 'Gel pedicure',
      description: 'The classic pedicure, finished in long-wear gel for a glossy colour that stays put.',
      durationMinutes: 60,
      priceCents: 7000,
      bufferAfterMin: 5,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'tech', kind: 'staff', skillTags: ['pedicure'], count: 1 }],
      policyHandle: 'nail-standard',
    },
    {
      handle: 'nail-art',
      name: 'Nail art (per nail)',
      description: 'Hand-painted, per-nail detail — fine lines, negative space or a chrome accent, added to any set.',
      durationMinutes: 30,
      priceCents: 1500,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'tech', kind: 'staff', skillTags: ['art'], count: 1 },
        { role: 'station', kind: 'table', skillTags: [], count: 1 },
      ],
      policyHandle: 'nail-standard',
    },
    {
      handle: 'soak-off',
      name: 'Soak-off removal',
      description: 'Gentle, no-damage removal of an existing gel or builder set, cuticles conditioned to finish.',
      durationMinutes: 20,
      priceCents: 1500,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'tech', kind: 'staff', skillTags: ['manicure'], count: 1 },
        { role: 'station', kind: 'table', skillTags: [], count: 1 },
      ],
      policyHandle: 'nail-standard',
    },
  ],
};

// ── Home — gallery-forward: photo → the work → menu → why → studio → team → voice → book ─
const HOME = [
  photoHero({
    image: url(IMG.hero),
    alt: 'A calm, gallery-white nail studio with a single coral chair',
    title: 'Nails as a small work of art',
    sub: 'A quiet, gallery-clean studio for precise manicures, long-wear gel and hand-painted art — colour that does the talking.',
    primary: { label: 'Book online', href: '/book' },
    secondary: { label: 'See the work', href: '/book' },
    overlay: 'dark',
  }),
  galleryStrip({
    heading: 'The work',
    surface: 'base',
    columns: 4,
    images: [
      { src: url(IMG.work1), alt: 'A glossy coral-rose gel set' },
      { src: url(IMG.work2), alt: 'A minimal negative-space manicure' },
      { src: url(IMG.work3), alt: 'Fine-line hand-painted nail art' },
      { src: url(IMG.work4), alt: 'A sheer, clean-beauty natural finish' },
      { src: url(IMG.work5), alt: 'A deep-teal chrome accent nail' },
      { src: url(IMG.work6), alt: 'A soft, sculpted builder-gel set' },
      { src: url(IMG.work7), alt: 'A precise french with a modern tip' },
      { src: url(IMG.work8), alt: 'A matte micro-art detail on short nails' },
    ],
  }),
  serviceMenu({
    heading: 'The menu',
    intro: 'The things we do most. Full prices and live availability are on the booking page.',
    surface: 'muted',
    columns: 3,
    items: [
      { name: 'Classic manicure', priceCents: 3500, durationMin: 30, desc: 'Shape, cuticles, treatment and a flawless polish.' },
      { name: 'Gel manicure', priceCents: 5000, durationMin: 45, desc: 'Long-wear, high-gloss colour that lasts two weeks plus.' },
      { name: 'Builder-gel set', priceCents: 7500, durationMin: 75, desc: 'A sculpted overlay for length and strength.' },
      { name: 'Classic pedicure', priceCents: 5500, durationMin: 45, desc: 'Soak, shape, smooth and a polished finish.' },
      { name: 'Gel pedicure', priceCents: 7000, durationMin: 60, desc: 'The classic, finished in long-wear gel.' },
      { name: 'Nail art (per nail)', priceCents: 1500, durationMin: 30, desc: 'Hand-painted detail added to any set.' },
    ],
    cta: { label: 'See everything & book', href: '/book' },
  }),
  featureRow({
    items: [
      {
        title: 'Clean beauty, by default',
        body: 'Fresh files and buffers every time, thorough tool sterilisation, and gentle, better-for-you formulas — care you don’t have to ask for.',
      },
      {
        title: 'Precision over speed',
        body: 'We book realistic slots so nothing is rushed. Straight lines, clean cuticles and an even finish — the details that read as “done well”.',
      },
      {
        title: 'Art, not a template',
        body: 'Bring a reference or a vague idea. Our artists design to your hands, not a pre-set sheet — one nail or a full editorial set.',
      },
    ],
  }),
  splitFeature({
    image: url(IMG.interior),
    alt: 'A minimal manicure station in warm daylight',
    heading: 'A gallery, not a nail bar',
    body: [
      'Lacquer is a small, daylight studio built around the work: a neutral room, two stations, and colour that gets to be the loudest thing in it.',
      'No conveyor belt, no queue out the door. Just a calm chair, a proper consultation and a finish precise enough to photograph.',
    ],
    cta: { label: 'Book your chair', href: '/book' },
  }),
  teamRow({
    heading: 'The artists',
    intro: 'Book by name — you’ll sit with the same hands each visit.',
    members: [
      { name: 'Lena Ohno', role: 'Lead nail artist', image: url(IMG.lena), alt: 'Lena Ohno, lead nail artist', bio: 'Fine-line art and sculpted builder-gel. Lena leads the studio.' },
      { name: 'Cai Fontaine', role: 'Nail technician', image: url(IMG.cai), alt: 'Cai Fontaine, nail technician', bio: 'Flawless gel and the cleanest classic manicure in the room.' },
      { name: 'Rosa Márquez', role: 'Nail artist', image: url(IMG.rosa), alt: 'Rosa Márquez, nail artist', bio: 'Negative space, chrome and modern french — quiet, precise art.' },
    ],
  }),
  testimonial({
    quote: 'It feels more like sitting for a portrait than a nail appointment. Clean, unhurried, and the set lasted three weeks without a chip.',
    attribution: 'Imani, client since 2024',
    surface: 'muted',
  }),
  bookingCta({
    title: 'Ready when you are',
    sub: 'Pick a service, choose your artist and see live times. It takes about a minute.',
    cta: { label: 'Book online', href: '/book' },
  }),
];

const BOOK_INTRO = [
  photoHero({
    image: url(IMG.interior),
    alt: 'A minimal manicure station in warm daylight',
    title: 'Book your appointment',
    sub: 'Choose a service to see prices and live availability, then pick your artist and time.',
    primary: { label: 'See services below', href: '/book' },
    overlay: 'darker',
    align: 'start',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.hero),
    alt: 'A calm, gallery-white nail studio with a single coral chair',
    heading: 'About Lacquer',
    body: [
      'We opened Lacquer to do nails the way a gallery hangs a picture — on a clean, quiet wall, with nothing competing for the eye but the work itself.',
      'That means realistic booking times, genuinely clean beauty practices, and artists who design to your hands. No rushing, no template sheet, no set you can’t live in.',
    ],
    cta: { label: 'Book a chair', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'How we work',
    items: [
      { title: 'Consultation first', body: 'Every appointment starts with a real look at your nails, your routine and what you actually want to leave with.' },
      { title: 'Hygiene you can see', body: 'Single-use files and buffers, hospital-grade tool sterilisation, and gentle formulas — the standard, not an upgrade.' },
      { title: 'Made to last', body: 'We finish with aftercare that keeps a set looking new for weeks, and honest advice on when to come back.' },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Visit the studio',
    address: ['Lacquer', '34 Quill Lane', 'Unit 1 · Portland, OR 97209'],
    mapLocation: '34 Quill Lane, Portland, OR 97209',
    hours: [
      { day: 'Tuesday – Friday', time: '10:00 – 7:00' },
      { day: 'Saturday', time: '9:00 – 6:00' },
      { day: 'Sunday', time: '11:00 – 4:00' },
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
  key: 'sparx-nail-gallery',
  name: 'Nail Studio (Gallery)',
  summary:
    'A gallery-chic nail-studio site — a clean gallery-cream palette, a coral-rose primary and a deep-teal accent under a crisp grotesque display, with the nail-art photography carrying the page. Installs a working booking flow: a real menu (manicures, gel, builder-gel, pedicures, art, removal), three artists you book by name, and two shared nail stations a manicure consumes alongside its artist. Ships as "Lacquer", a calm daylight studio.',
  tagline: 'A gallery-chic template for nail studios — book online from day one.',
  industry: 'Nail studio',
  sortWeight: 84,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'Lacquer', tagline: 'Nails as a small work of art.' },
  theme: lacquer,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Lacquer — a modern nail studio',
      description:
        'Lacquer is a calm, gallery-clean nail studio for precise manicures, long-wear gel and hand-painted art. Book your artist online.',
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
