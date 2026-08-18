// sparx-tattoo-fineline — "Faint", a bright, minimal FINE-LINE tattoo studio.
//
// The light, airy, clean-gallery studio: a bone/off-white ground, a warm near-black
// ink, ONE quiet soft-gold accent, and a clean grotesque over a humanist sans. Delicate,
// considered, editorial-minimal — deliberately the OPPOSITE of the dark tattoo studio
// (heavy ink, black walls, flash-sheet grit). Same booking spine, a different room: here
// the walls are white and the work hangs like a gallery.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @wizeworks/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-tattoo-fineline.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-tattoo-fineline/**" \
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
  serviceMenu,
  splitFeature,
  STATUS_ON_DARK,
  STATUS_ON_LIGHT,
  teamRow,
  testimonial,
  typeHero,
  type ServiceSiteSpec,
} from './service-sites/harness';

// ── Imagery (swap-ready; each id also names an entry in ASSETS) ────────────────────
const IMG = {
  studio: 'tattoo-fineline-studio',
  process: 'tattoo-fineline-process',
  wren: 'tattoo-fineline-wren',
  sol: 'tattoo-fineline-sol',
  iris: 'tattoo-fineline-iris',
  work1: 'tattoo-fineline-work1',
  work2: 'tattoo-fineline-work2',
  work3: 'tattoo-fineline-work3',
  work4: 'tattoo-fineline-work4',
  work5: 'tattoo-fineline-work5',
  work6: 'tattoo-fineline-work6',
  work7: 'tattoo-fineline-work7',
  work8: 'tattoo-fineline-work8',
} as const;

const PHOTO: Record<string, string> = {
  "faint-studio": "https://images.unsplash.com/photo-1665000805953-07c06558ae90?w=1600&q=80",
  "faint-process": "https://images.unsplash.com/photo-1736594635582-7f60e14604cc?w=1600&q=80",
  "faint-wren": "https://images.unsplash.com/photo-1761956323091-343849aa1576?w=1600&q=80",
  "faint-sol": "https://images.unsplash.com/photo-1614769842925-8193ebda68b5?w=1600&q=80",
  "faint-iris": "https://images.unsplash.com/photo-1563815241656-2dfe4fbb4775?w=1600&q=80",
  "faint-work1": "https://images.unsplash.com/photo-1547754145-ef9ff306e3f3?w=1600&q=80",
  "faint-work2": "https://images.unsplash.com/photo-1570168983832-8989dae1522e?w=1600&q=80",
  "faint-work3": "https://images.unsplash.com/photo-1523346889551-06a8879f5c71?w=1600&q=80",
  "faint-work4": "https://images.unsplash.com/photo-1547754145-ef9ff306e3f3?w=1600&q=80",
  "faint-work5": "https://images.unsplash.com/photo-1570168983832-8989dae1522e?w=1600&q=80",
  "faint-work6": "https://images.unsplash.com/photo-1523346889551-06a8879f5c71?w=1600&q=80",
  "faint-work7": "https://images.unsplash.com/photo-1547754145-ef9ff306e3f3?w=1600&q=80",
  "faint-work8": "https://images.unsplash.com/photo-1570168983832-8989dae1522e?w=1600&q=80",
};
const src = (seed: string): string =>
  PHOTO[seed] ?? `https://picsum.photos/seed/${seed}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}
const ASSETS: Asset[] = [
  { id: IMG.studio, url: src('faint-studio'), alt: 'A bright, minimal tattoo studio with white walls and natural light' },
  { id: IMG.process, url: src('faint-process'), alt: 'A single fine needle tracing a delicate line on skin' },
  { id: IMG.wren, url: src('faint-wren'), alt: 'Wren Ashby, fine-line and lettering artist' },
  { id: IMG.sol, url: src('faint-sol'), alt: 'Sol Marés, fine-line and botanical artist' },
  { id: IMG.iris, url: src('faint-iris'), alt: 'Iris Devlin, fine-line artist and studio lead' },
  { id: IMG.work1, url: src('faint-work1'), alt: 'A single fine-line botanical stem on a forearm' },
  { id: IMG.work2, url: src('faint-work2'), alt: 'Delicate script lettering along the collarbone' },
  { id: IMG.work3, url: src('faint-work3'), alt: 'A minimal line-work bird, no shading' },
  { id: IMG.work4, url: src('faint-work4'), alt: 'A small floral cluster in fine line' },
  { id: IMG.work5, url: src('faint-work5'), alt: 'A thin geometric line piece on an inner arm' },
  { id: IMG.work6, url: src('faint-work6'), alt: 'A single-needle wildflower on an ankle' },
  { id: IMG.work7, url: src('faint-work7'), alt: 'Fine cursive script on an inner bicep' },
  { id: IMG.work8, url: src('faint-work8'), alt: 'A delicate line-work portrait study' },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-tattoo-fineline: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "faint": bone off-white ground, warm near-black ink, ONE quiet soft-gold ──
const faint = defineTheme({
  name: 'faint',
  type: { body: face('Inter', 'sans-serif'), head: face('Space Grotesk', 'sans-serif') },
  shape: { selector: '0.25rem', field: '0.25rem', box: '0.25rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(98% 0.004 85)', // bone off-white ground
      'oklch(96% 0.005 85)', // paper
      'oklch(91% 0.006 82)', // hairline
      'oklch(22% 0.008 62)', // warm near-black ink
    ],
    roles: {
      primary: 'oklch(74% 0.055 80)', // soft gold
      secondary: 'oklch(45% 0.008 62)', // warm grey
      accent: 'oklch(60% 0.02 72)', // muted stone
      neutral: 'oklch(24% 0.008 62)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(20% 0.006 62)',
      'oklch(17% 0.005 62)',
      'oklch(14% 0.004 62)',
      'oklch(96% 0.004 85)',
    ],
    roles: {
      primary: 'oklch(80% 0.07 82)',
      secondary: 'oklch(72% 0.008 70)',
      accent: 'oklch(70% 0.03 72)',
      neutral: 'oklch(82% 0.008 70)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the booking spine (policies, artists + hours, the fine-line menu) ─────
const hours = (days: number[], startMinute: number, endMinute: number) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

const SCHEDULING = {
  policies: [
    {
      handle: 'consultation-none',
      name: 'Consultation',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [1440, 120],
      policyText:
        'A short, free consultation — no deposit. Give us a day’s notice if you need to move it, and we’ll find another time.',
    },
    {
      handle: 'session-deposit',
      name: 'Session deposit',
      depositType: 'deposit',
      depositAmountCents: 4000,
      cancellationWindowHours: 72,
      reminderOffsetsMin: [2880, 1440, 120],
      policyText:
        'Tattoo sessions hold a $40 deposit that comes off your total. Reschedule with 72 hours’ notice and it carries over; inside that window it books your artist’s day, so it stays with us.',
    },
  ],
  resources: [
    {
      handle: 'iris',
      name: 'Iris Devlin',
      kind: 'staff',
      skillTags: ['fine-line', 'lettering', 'botanical'],
      windows: hours([2, 4, 5, 6], 660, 1080), // Tue, Thu–Sat 11–6
    },
    {
      handle: 'wren',
      name: 'Wren Ashby',
      kind: 'staff',
      skillTags: ['fine-line', 'lettering'],
      windows: hours([2, 3, 4, 5, 6], 660, 1140), // Tue–Sat 11–7
    },
    {
      handle: 'sol',
      name: 'Sol Marés',
      kind: 'staff',
      skillTags: ['fine-line', 'botanical'],
      windows: hours([3, 4, 5, 6, 0], 720, 1200), // Wed–Sun 12–8
    },
  ],
  services: [
    {
      handle: 'consultation',
      name: 'Consultation',
      description:
        'A short sit-down to talk through your idea, placement and sizing before anything is booked. Free, and there’s no obligation to book after.',
      durationMinutes: 20,
      priceCents: 0,
      requiresApproval: true,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'artist', kind: 'staff', skillTags: ['fine-line'], count: 1 }],
      policyHandle: 'consultation-none',
    },
    {
      handle: 'fineline-small',
      name: 'Fine-line — small',
      description: 'A small single-needle piece — a stem, a symbol, a few words. About an hour in the chair.',
      durationMinutes: 60,
      priceCents: 12000,
      bufferAfterMin: 15,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'artist', kind: 'staff', skillTags: ['fine-line'], count: 1 }],
      policyHandle: 'session-deposit',
    },
    {
      handle: 'fineline-medium',
      name: 'Fine-line — medium',
      description: 'A more detailed line piece — a small composition or a set of elements. Around two hours.',
      durationMinutes: 120,
      priceCents: 24000,
      bufferAfterMin: 15,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'artist', kind: 'staff', skillTags: ['fine-line'], count: 1 }],
      policyHandle: 'session-deposit',
    },
    {
      handle: 'fineline-large',
      name: 'Fine-line — large',
      description: 'A larger, layered line piece across a full placement. A considered three-hour session.',
      durationMinutes: 180,
      priceCents: 36000,
      bufferAfterMin: 20,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'artist', kind: 'staff', skillTags: ['fine-line'], count: 1 }],
      policyHandle: 'session-deposit',
    },
    {
      handle: 'lettering-script',
      name: 'Lettering & script',
      description: 'Fine cursive or hand-drawn script — a name, a date, a line worth keeping. Set with your artist.',
      durationMinutes: 90,
      priceCents: 18000,
      bufferAfterMin: 15,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'artist', kind: 'staff', skillTags: ['lettering'], count: 1 }],
      policyHandle: 'session-deposit',
    },
    {
      handle: 'delicate-floral',
      name: 'Delicate floral',
      description: 'Botanical fine-line work — single stems, wildflowers, small clusters — drawn light and precise.',
      durationMinutes: 120,
      priceCents: 22000,
      bufferAfterMin: 15,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'artist', kind: 'staff', skillTags: ['botanical'], count: 1 }],
      policyHandle: 'session-deposit',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  typeHero({
    title: 'Fine lines, meant to last.',
    sub: 'A bright, quiet studio for delicate fine-line tattoos — considered work, unhurried sessions, and a plan you leave with before any needle touches skin.',
    primary: { label: 'Book a consultation', href: '/book' },
    secondary: { label: 'See the work', href: '/book' },
    surface: 'base',
  }),
  galleryStrip({
    heading: 'Selected work',
    surface: 'base',
    columns: 4,
    images: [
      { src: url(IMG.work1), alt: 'A single fine-line botanical stem on a forearm' },
      { src: url(IMG.work2), alt: 'Delicate script lettering along the collarbone' },
      { src: url(IMG.work3), alt: 'A minimal line-work bird, no shading' },
      { src: url(IMG.work4), alt: 'A small floral cluster in fine line' },
      { src: url(IMG.work5), alt: 'A thin geometric line piece on an inner arm' },
      { src: url(IMG.work6), alt: 'A single-needle wildflower on an ankle' },
      { src: url(IMG.work7), alt: 'Fine cursive script on an inner bicep' },
      { src: url(IMG.work8), alt: 'A delicate line-work portrait study' },
    ],
  }),
  serviceMenu({
    heading: 'What we do',
    intro: 'Fine-line work, priced by size and detail. Every piece starts with a free consultation. Live availability is on the booking page.',
    surface: 'muted',
    columns: 3,
    items: [
      { name: 'Fine-line — small', priceCents: 12000, durationMin: 60, desc: 'A single-needle piece — a stem, a symbol, a few words.' },
      { name: 'Fine-line — medium', priceCents: 24000, durationMin: 120, desc: 'A more detailed line piece or a small composition.' },
      { name: 'Fine-line — large', priceCents: 36000, durationMin: 180, desc: 'A larger, layered piece across a full placement.' },
      { name: 'Lettering & script', priceCents: 18000, durationMin: 90, desc: 'Fine cursive or hand-drawn script, set with your artist.' },
      { name: 'Delicate floral', priceCents: 22000, durationMin: 120, desc: 'Botanical fine-line — single stems and small clusters.' },
    ],
    cta: { label: 'See everything & book', href: '/book' },
  }),
  splitFeature({
    image: url(IMG.process),
    alt: 'A single fine needle tracing a delicate line on skin',
    heading: 'How a session works',
    body: [
      'It starts with a short, free consultation — we talk through the idea, the placement and the size, and agree on a design before we book anything.',
      'On the day, we take our time: a fresh stencil, a single needle, and a slow, precise hand. Fine-line work rewards patience, so we never rush the chair.',
      'You leave with clear aftercare and a piece drawn to settle softly and hold its line for years, not months.',
    ],
    cta: { label: 'Book a consultation', href: '/book' },
  }),
  teamRow({
    heading: 'Artists',
    intro: 'Book by name — you’ll work with the same artist from the first line to the last.',
    surface: 'muted',
    members: [
      { name: 'Iris Devlin', role: 'Studio lead · fine line', image: url(IMG.iris), alt: 'Iris Devlin, fine-line artist and studio lead', bio: 'Minimal line work and quiet compositions. Iris runs the studio.' },
      { name: 'Wren Ashby', role: 'Fine line · lettering', image: url(IMG.wren), alt: 'Wren Ashby, fine-line and lettering artist', bio: 'Hand-drawn script and fine cursive, set to fit the body.' },
      { name: 'Sol Marés', role: 'Fine line · botanical', image: url(IMG.sol), alt: 'Sol Marés, fine-line and botanical artist', bio: 'Single stems, wildflowers and delicate botanical detail.' },
    ],
  }),
  testimonial({
    quote: 'They talked me out of making it bigger, then drew exactly what I’d pictured. A year on the line is still crisp — and the room felt like a gallery, not a garage.',
    attribution: 'Devi, client since 2024',
  }),
  bookingCta({
    title: 'Start with a consultation.',
    sub: 'Tell us the idea, pick your artist, and see live times. It takes about a minute, and the first conversation is free.',
    cta: { label: 'Book online', href: '/book' },
  }),
];

const BOOK_INTRO = [
  typeHero({
    title: 'Book your session',
    sub: 'Choose a service to see prices and live availability, then pick your artist and time. New ideas start with a free consultation.',
    primary: { label: 'See services below', href: '/book' },
    surface: 'muted',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.studio),
    alt: 'A bright, minimal tattoo studio with white walls and natural light',
    heading: 'About Faint',
    body: [
      'Faint is a small, bright fine-line studio — white walls, good light, and work that hangs like a gallery. We opened it to prove a tattoo shop doesn’t have to be dark to be serious.',
      'We do one thing carefully: delicate line work. No walk-in flash wall, no rushing, no talking you into more than you came for — just a considered piece, drawn light and made to last.',
    ],
    cta: { label: 'Book a consultation', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'How we work',
    items: [
      { title: 'A plan before a needle', body: 'Every piece begins with a free consultation. We agree the design, size and placement before anything is booked.' },
      { title: 'One artist, start to finish', body: 'You book by name and stay with the same hand — someone who knows the line they’re drawing and why.' },
      { title: 'Clean, calm, unhurried', body: 'A single-use, single-needle setup in a quiet room. We take the time fine-line work actually needs.' },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Visit the studio',
    address: ['Faint', '14 Alder Lane', 'Studio 3 · Portland, OR 97209'],
    mapLocation: '14 Alder Lane, Portland, OR 97209',
    hours: [
      { day: 'Tuesday – Saturday', time: '11:00 – 8:00' },
      { day: 'Sunday', time: '12:00 – 6:00' },
      { day: 'Monday', time: 'Closed' },
    ],
  }),
  bookingCta({
    title: 'Rather book than call?',
    sub: 'See live availability and reserve your consultation online — no phone tag.',
    surface: 'muted',
    cta: { label: 'Book online', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-tattoo-fineline',
  name: 'Tattoo (Fine Line)',
  summary:
    'A bright, minimal fine-line tattoo-studio site — a bone off-white palette, a warm near-black ink and one quiet soft-gold accent, with a clean grotesque and gallery-style work carrying the page. Installs a working booking flow: a free consultation, fine-line pieces priced by size, plus lettering and delicate floral; three artists you book by name with their own hours; and a session-deposit policy. Ships as "Faint", a light, considered studio — the calm opposite of the dark tattoo shop.',
  tagline: 'A bright, editorial template for fine-line tattoo studios — book online from day one.',
  industry: 'Tattoo studio',
  sortWeight: 85,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'Faint', tagline: 'Fine lines, made to last.' },
  theme: faint,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Faint — a fine-line tattoo studio',
      description:
        'Faint is a bright, minimal fine-line tattoo studio for delicate line work, lettering and botanical pieces. Book your artist online, starting with a free consultation.',
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
