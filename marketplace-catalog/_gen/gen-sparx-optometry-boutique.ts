// sparx-optometry-boutique — "Iris Optical", a modern BOUTIQUE optical & eye-care studio.
//
// The design-forward eyewear studio: a deep charcoal/ink primary, a warm brass accent, a
// crisp near-white ground and a refined modern display (Fraunces over Inter). Sleek, tight
// radii, soft-lit studio photography. Deliberately the OPPOSITE of the warm family-practice
// optometry template — same booking spine, an elevated eyewear-studio structure: designer &
// independent frames, precision exams, personal styling. The functional core is BOOKING an
// exam or a styling appointment; exams pair an optometrist with an exam room.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-optometry-boutique.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-optometry-boutique/**" \
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
  hero: 'optometry-boutique-hero',
  studio: 'optometry-boutique-studio',
  frames: 'optometry-boutique-frames',
  lena: 'optometry-boutique-lena',
  omar: 'optometry-boutique-omar',
  june: 'optometry-boutique-june',
  tal: 'optometry-boutique-tal',
  work1: 'optometry-boutique-work1',
  work2: 'optometry-boutique-work2',
  work3: 'optometry-boutique-work3',
} as const;

// No hosted photography for this bundle — every image falls back to a deterministic picsum
// seed (prefixed `iris-` so the seeds stay unique to this template).
const PHOTO: Record<string, string> = {
  "iris-hero": "https://images.unsplash.com/photo-1646084081219-1090f72a531c?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZGVzaWduZXIlMjBleWVnbGFzc2VzfGVufDB8MHx8fDE3ODYzOTIxMzN8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "iris-studio": "https://images.unsplash.com/photo-1593214451196-37e0651f8ef2?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bW9kZXJuJTIwb3B0aWNhbCUyMHNob3AlMjBpbnRlcmlvcnxlbnwwfDB8fHwxNzg2MzkyMTM2fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "iris-frames": "https://images.unsplash.com/photo-1611222777277-61319d63ca94?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZXlld2VhciUyMGZyYW1lcyUyMGRpc3BsYXl8ZW58MHwwfHx8MTc4NjM5MjEzOXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "iris-lena": "https://images.unsplash.com/photo-1757386320806-e3f03c9f41e8?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjBvcHRvbWV0cmlzdCUyMHBvcnRyYWl0fGVufDB8MHx8fDE3ODYzOTIxMjF8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "iris-omar": "https://images.unsplash.com/photo-1568602471122-7832951cc4c5?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8b3B0aWNpYW4lMjBwb3J0cmFpdCUyMG1hbnxlbnwwfDB8fHwxNzg2MzkyMTQyfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "iris-june": "https://images.unsplash.com/photo-1506863530036-1efeddceb993?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjBzdHlsaXN0JTIwcG9ydHJhaXR8ZW58MHwwfHx8MTc4NjM5MjE0NXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "iris-tal": "https://images.unsplash.com/photo-1513673054901-2b5f51551112?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZXlld2VhciUyMHN0eWxpc3QlMjBwb3J0cmFpdHxlbnwwfDB8fHwxNzg2MzkyMTQ3fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "iris-work1": "https://images.unsplash.com/photo-1513673054901-2b5f51551112?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c3R5bGlzaCUyMGdsYXNzZXMlMjBwb3J0cmFpdHxlbnwwfDB8fHwxNzg2MzkyMTUyfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "iris-work2": "https://images.unsplash.com/photo-1663901303513-9f14f6ef6b23?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bHV4dXJ5JTIwZXlld2VhcnxlbnwwfDB8fHwxNzg2MzkyMTU0fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "iris-work3": "https://images.unsplash.com/photo-1516714819001-8ee7a13b71d7?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGVyc29uJTIwd2VhcmluZyUyMGdsYXNzZXN8ZW58MHwwfHx8MTc4NjM5MjE1N3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (seed: string): string =>
  PHOTO[seed] ?? `https://picsum.photos/seed/${seed}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}
const ASSETS: Asset[] = [
  { id: IMG.hero, url: src('iris-hero'), alt: 'A sleek eyewear studio wall of designer frames under soft light' },
  { id: IMG.studio, url: src('iris-studio'), alt: 'A minimal charcoal styling counter with a mirror and frame trays' },
  { id: IMG.frames, url: src('iris-frames'), alt: 'A curated row of independent acetate and metal frames' },
  { id: IMG.lena, url: src('iris-lena'), alt: 'Dr. Lena Okafor, optometrist' },
  { id: IMG.omar, url: src('iris-omar'), alt: 'Dr. Omar Reyes, optometrist' },
  { id: IMG.june, url: src('iris-june'), alt: 'June Park, eyewear stylist' },
  { id: IMG.tal, url: src('iris-tal'), alt: 'Tal Mercer, eyewear stylist' },
  { id: IMG.work1, url: src('iris-work1'), alt: 'A pair of sculptural acetate frames styled on a face' },
  { id: IMG.work2, url: src('iris-work2'), alt: 'Thin titanium frames on a charcoal display block' },
  { id: IMG.work3, url: src('iris-work3'), alt: 'A digital eye exam in progress in a clean exam room' },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-optometry-boutique: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "iris": deep charcoal ink, warm brass accent, crisp near-white ground ─────
const iris = defineTheme({
  name: 'iris',
  type: { body: face('Inter', 'sans-serif'), head: face('Fraunces', 'serif') },
  shape: { selector: '0.25rem', field: '0.25rem', box: '0.375rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(98% 0.003 250)', // crisp near-white
      'oklch(95% 0.004 250)', // soft greige
      'oklch(90% 0.006 255)', // hairline
      'oklch(22% 0.015 260)', // ink charcoal
    ],
    roles: {
      primary: 'oklch(27% 0.02 260)', // deep charcoal / ink
      secondary: 'oklch(38% 0.014 260)', // dark, readable micro-labels on light
      accent: 'oklch(70% 0.095 75)', // warm brass
      neutral: 'oklch(26% 0.015 260)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(20% 0.012 260)',
      'oklch(16% 0.01 260)',
      'oklch(13% 0.008 260)',
      'oklch(95% 0.004 250)',
    ],
    roles: {
      primary: 'oklch(91% 0.01 255)', // near-white ink fill on charcoal
      secondary: 'oklch(74% 0.012 260)',
      accent: 'oklch(77% 0.09 76)',
      neutral: 'oklch(83% 0.012 260)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the booking spine (policies, optometrists + stylists + exam rooms) ────
const hours = (days: number[], startMinute: number, endMinute: number) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

const SCHEDULING = {
  policies: [
    {
      handle: 'studio-standard',
      name: 'Standard booking',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [1440, 120],
      policyText:
        'Please give us at least 24 hours’ notice to change or cancel. We send a reminder the day before and two hours ahead.',
    },
    {
      handle: 'exam-no-show',
      name: 'Exam no-show policy',
      depositType: 'none',
      cancellationWindowHours: 24,
      lateCancelFeeType: 'fixed',
      lateCancelFeeValue: 2500,
      noShowFeeType: 'fixed',
      noShowFeeValue: 4000,
      reminderOffsetsMin: [2880, 1440, 120],
      policyText:
        'Eye exams are one-to-one with a doctor and an exam room. Cancel with less than 24 hours’ notice and a $25 late-cancel fee applies; a missed appointment carries a $40 no-show fee.',
    },
  ],
  resources: [
    {
      handle: 'dr-lena',
      name: 'Dr. Lena Okafor',
      kind: 'staff',
      skillTags: ['exam', 'contacts', 'medical'],
      windows: hours([2, 3, 4, 5, 6], 540, 1050), // Tue–Sat 9–5:30
    },
    {
      handle: 'dr-omar',
      name: 'Dr. Omar Reyes',
      kind: 'staff',
      skillTags: ['exam', 'contacts', 'medical'],
      windows: hours([1, 2, 3, 4, 5], 600, 1080), // Mon–Fri 10–6
    },
    {
      handle: 'june',
      name: 'June Park',
      kind: 'staff',
      skillTags: ['styling', 'fitting', 'lenses'],
      windows: hours([1, 2, 3, 4, 5, 6], 600, 1140), // Mon–Sat 10–7
    },
    {
      handle: 'tal',
      name: 'Tal Mercer',
      kind: 'staff',
      skillTags: ['styling', 'fitting'],
      windows: hours([3, 4, 5, 6, 0], 660, 1200), // Wed–Sun 11–8
    },
    {
      handle: 'exam-room-1',
      name: 'Exam Room 1',
      kind: 'space',
      skillTags: ['exam-room'],
      windows: hours([1, 2, 3, 4, 5, 6], 540, 1200),
    },
    {
      handle: 'exam-room-2',
      name: 'Exam Room 2',
      kind: 'space',
      skillTags: ['exam-room'],
      windows: hours([1, 2, 3, 4, 5, 6], 540, 1200),
    },
  ],
  services: [
    {
      handle: 'comprehensive-exam',
      name: 'Comprehensive eye exam',
      description:
        'A full vision and eye-health exam with digital retinal imaging — the one that keeps your prescription and your eyes in check.',
      durationMinutes: 45,
      priceCents: 12000,
      bufferAfterMin: 10,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'provider', kind: 'staff', skillTags: ['exam'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['exam-room'], count: 1 },
      ],
      policyHandle: 'exam-no-show',
    },
    {
      handle: 'contact-lens-exam',
      name: 'Contact lens exam & fitting',
      description:
        'Everything in the eye exam, plus a fitting and trial lenses — for new wearers or a fresh contact prescription.',
      durationMinutes: 60,
      priceCents: 15000,
      bufferAfterMin: 10,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'provider', kind: 'staff', skillTags: ['exam'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['exam-room'], count: 1 },
      ],
      policyHandle: 'exam-no-show',
    },
    {
      handle: 'eyewear-styling',
      name: 'Eyewear styling session',
      description:
        'Sit down with a stylist and try the studio — we’ll pull frames for your face, colouring and how you live, no pressure to buy.',
      durationMinutes: 45,
      priceCents: 0,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'stylist', kind: 'staff', skillTags: ['styling'], count: 1 },
      ],
      policyHandle: 'studio-standard',
    },
    {
      handle: 'lens-consultation',
      name: 'Premium lens consultation',
      description:
        'A short sit-down on lenses — thinner high-index, anti-glare, blue-light and progressive options — so your pair works as hard as it looks.',
      durationMinutes: 30,
      priceCents: 0,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'stylist', kind: 'staff', skillTags: ['styling'], count: 1 },
      ],
      policyHandle: 'studio-standard',
    },
    {
      handle: 'frame-trunk-show-appointment',
      name: 'Trunk show appointment',
      description:
        'A private slot during a visiting designer trunk show — first look at the new collection with a stylist to guide you.',
      durationMinutes: 60,
      priceCents: 0,
      requiresApproval: true,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'stylist', kind: 'staff', skillTags: ['styling'], count: 1 },
      ],
      policyHandle: 'studio-standard',
    },
    {
      handle: 'adjustment-repair',
      name: 'Adjustment & minor repair',
      description:
        'Frames feeling loose or crooked? Drop in for a professional adjustment, nose-pad swap or minor repair — quick and on us.',
      durationMinutes: 20,
      priceCents: 0,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'stylist', kind: 'staff', skillTags: ['styling'], count: 1 },
      ],
      policyHandle: 'studio-standard',
    },
    {
      handle: 'second-pair-styling',
      name: 'Second-pair styling',
      description:
        'You’ve got the everyday pair — now the sunglasses, the reading pair or the bold one. A focused session for your next frame.',
      durationMinutes: 30,
      priceCents: 0,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'stylist', kind: 'staff', skillTags: ['styling'], count: 1 },
      ],
      policyHandle: 'studio-standard',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  photoHero({
    image: url(IMG.hero),
    alt: 'A sleek eyewear studio wall of designer frames under soft light',
    title: 'Eyewear worth looking twice at',
    sub: 'A boutique optical studio for designer and independent frames, precision eye exams and styling that starts with your face, not a catalogue.',
    primary: { label: 'Book an exam', href: '/book' },
    secondary: { label: 'Book a styling appointment', href: '/book' },
    overlay: 'darker',
  }),
  featureRow({
    items: [
      {
        title: 'Independent & designer frames',
        body: 'A tightly edited wall of labels you won’t find in a chain — acetate, titanium and hand-finished pieces, chosen for design, not shelf space.',
      },
      {
        title: 'Precision digital exams',
        body: 'A full eye-health exam with retinal imaging, read by an optometrist who takes the time — never a five-minute conveyor belt.',
      },
      {
        title: 'Personal styling',
        body: 'A stylist pulls frames for your face shape, colouring and how you actually live, so you leave with a pair you reach for.',
      },
      {
        title: 'Premium lenses, done right',
        body: 'Thinner high-index, anti-glare and progressive lenses fitted and measured properly — the part that decides how a pair really feels.',
      },
    ],
  }),
  serviceMenu({
    heading: 'Book a visit',
    intro: 'Exams and styling sessions, side by side. Full details and live availability are on the booking page.',
    surface: 'muted',
    columns: 2,
    items: [
      { name: 'Comprehensive eye exam', priceCents: 12000, durationMin: 45, desc: 'Full vision & eye-health exam with digital imaging.' },
      { name: 'Contact lens exam & fitting', priceCents: 15000, durationMin: 60, desc: 'Exam plus a fitting and trial lenses.' },
      { name: 'Eyewear styling session', priceCents: 0, durationMin: 45, desc: 'A stylist pulls frames for you — no pressure to buy.' },
      { name: 'Premium lens consultation', priceCents: 0, durationMin: 30, desc: 'Find the right lens for how you see and live.' },
    ],
    cta: { label: 'See everything & book', href: '/book' },
  }),
  galleryStrip({
    heading: 'On the wall this season',
    columns: 3,
    images: [
      { src: url(IMG.work1), alt: 'A pair of sculptural acetate frames styled on a face' },
      { src: url(IMG.work2), alt: 'Thin titanium frames on a charcoal display block' },
      { src: url(IMG.frames), alt: 'A curated row of independent acetate and metal frames' },
    ],
  }),
  splitFeature({
    image: url(IMG.studio),
    alt: 'A minimal charcoal styling counter with a mirror and frame trays',
    heading: 'The studio, not a chain',
    body: [
      'Iris Optical is a single considered room — a curated wall of frames, two exam rooms and a styling counter where the whole visit slows down.',
      'That’s the point of a boutique: fewer frames chosen more carefully, an optometrist who isn’t watching the clock, and a stylist who sees the pair before you do.',
    ],
    cta: { label: 'Book your visit', href: '/book' },
  }),
  teamRow({
    heading: 'The people behind the pair',
    intro: 'Book an exam by doctor, or a styling session by name.',
    members: [
      { name: 'Dr. Lena Okafor', role: 'Optometrist', image: url(IMG.lena), alt: 'Dr. Lena Okafor, optometrist', bio: 'Comprehensive exams and complex contact fittings. Lena founded the studio.' },
      { name: 'Dr. Omar Reyes', role: 'Optometrist', image: url(IMG.omar), alt: 'Dr. Omar Reyes, optometrist', bio: 'Dry-eye, myopia care and a patient, thorough exam room.' },
      { name: 'June Park', role: 'Eyewear stylist', image: url(IMG.june), alt: 'June Park, eyewear stylist', bio: 'Frame styling and lens fitting — the eye that finds your pair fast.' },
      { name: 'Tal Mercer', role: 'Eyewear stylist', image: url(IMG.tal), alt: 'Tal Mercer, eyewear stylist', bio: 'Bold shapes, sunglasses and second pairs. Loves a trunk show.' },
    ],
  }),
  splitFeature({
    image: url(IMG.frames),
    alt: 'A curated row of independent acetate and metal frames',
    heading: 'Styling is the whole experience',
    body: [
      'Most people settle for the first frame that isn’t wrong. A styling session is the opposite — we pull for your face, your colouring and your day, then narrow it down together.',
      'Bring your prescription or get one here first. Either way you leave knowing the pair is right, and why.',
    ],
    reverse: true,
    surface: 'muted',
    cta: { label: 'Book a styling appointment', href: '/book' },
  }),
  testimonial({
    quote: 'I’ve worn glasses for twenty years and never enjoyed choosing them until here. The exam was thorough and the frame is genuinely me.',
    attribution: 'Devon, client since 2024',
  }),
  bookingCta({
    title: 'Ready to see clearly and look the part?',
    sub: 'Book a comprehensive exam or a styling session and see live times. It takes about a minute.',
    cta: { label: 'Book online', href: '/book' },
  }),
];

const BOOK_INTRO = [
  photoHero({
    image: url(IMG.studio),
    alt: 'A minimal charcoal styling counter with a mirror and frame trays',
    title: 'Book your visit',
    sub: 'Choose an exam or a styling session to see prices and live availability, then pick your doctor or stylist and time.',
    primary: { label: 'See services below', href: '/book' },
    overlay: 'darker',
    align: 'start',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.hero),
    alt: 'A sleek eyewear studio wall of designer frames under soft light',
    heading: 'About Iris Optical',
    body: [
      'We opened Iris Optical to do eyewear the way we always wanted it done — a real exam that isn’t rushed, a curated wall of frames worth the wait, and a stylist who treats choosing them as the good part.',
      'No pushy add-ons, no chain-store scripts. Just careful eye care and beautiful, well-fitted glasses you’re glad to be seen in.',
    ],
    cta: { label: 'Book a visit', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'How we work',
    items: [
      { title: 'The exam comes first', body: 'A full eye-health exam with digital imaging, read by an optometrist who takes the time to explain what they see.' },
      { title: 'Frames chosen, not stocked', body: 'A small, deliberate collection of independent and designer labels — quality and design over a wall of sameness.' },
      { title: 'Lenses done properly', body: 'Measured, fitted and matched to how you live — the invisible part that decides how a pair actually feels.' },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Visit the studio',
    address: ['Iris Optical', '44 Meridian Avenue', 'Suite 5 · Seattle, WA 98101'],
    mapLocation: '44 Meridian Avenue, Seattle, WA 98101',
    hours: [
      { day: 'Monday – Friday', time: '10:00 – 7:00' },
      { day: 'Saturday', time: '9:00 – 6:00' },
      { day: 'Sunday', time: '11:00 – 5:00' },
      { day: 'Exams', time: 'By appointment' },
    ],
  }),
  bookingCta({
    title: 'Rather book than call?',
    sub: 'See live availability for exams and styling and reserve your time online — no phone tag.',
    surface: 'muted',
    cta: { label: 'Book online', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-optometry-boutique',
  name: 'Optometry (Boutique)',
  summary:
    'A sleek, design-forward optical & eye-care studio site — a deep charcoal palette, a warm brass accent and a refined modern display, with online booking live from day one. Installs a working booking flow: comprehensive and contact-lens exams that pair an optometrist with an exam room, plus personal eyewear-styling appointments with a stylist — real hours, resources and a no-show policy. Ships as "Iris Optical", a boutique eyewear studio.',
  tagline: 'A sleek, boutique template for optical studios — book exams and styling online from day one.',
  industry: 'Optometry',
  sortWeight: 43,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'Iris Optical', tagline: 'Eyewear, considered.' },
  theme: iris,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Iris Optical — a boutique optical & eyewear studio',
      description:
        'Iris Optical is a design-forward optical studio for designer and independent frames, precision eye exams and personal styling. Book an exam or a styling session online.',
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
