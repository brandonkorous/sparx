// sparx-chiro-wellness — "Align Chiropractic", a modern WELLNESS chiropractic clinic.
//
// The calm, clean, everyday-wellness lane (gentle adjustments, posture, everyday pain
// relief, wellness plans, massage add-ons): a soft teal primary, a warm-coral accent, a
// clean near-white ground and a dark slate for readable micro-labels. Deliberately the
// OPPOSITE of the sports/rehab chiro template (athletic, performance, high-contrast) —
// this one is approachable and unhurried. Same booking spine, a different business: it
// books an appointment, and its scheduling routes a provider AND a treatment room.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @wizeworks/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-chiro-wellness.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-chiro-wellness/**" \
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
  hero: 'chiro-wellness-hero',
  interior: 'chiro-wellness-interior',
  ren: 'chiro-wellness-ren',
  sol: 'chiro-wellness-sol',
  mira: 'chiro-wellness-mira',
} as const;

const PHOTO: Record<string, string> = {
  "align-hero": "https://images.unsplash.com/photo-1706353399656-210cca727a33?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2hpcm9wcmFjdGljJTIwd2VsbG5lc3N8ZW58MHwwfHx8MTc4NjM5MDcxN3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "align-ren": "https://images.unsplash.com/photo-1757620765404-a1ee66df5e27?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2hpcm9wcmFjdG9yJTIwcG9ydHJhaXR8ZW58MHwwfHx8MTc4NjM5MDcyM3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "align-sol": "https://images.unsplash.com/photo-1659353888906-adb3e0041693?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjBkb2N0b3IlMjBwb3J0cmFpdHxlbnwwfDB8fHwxNzg2MzkwNzI2fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "align-mira": "https://images.unsplash.com/photo-1598901865264-4f5f30954532?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bWFzc2FnZSUyMHRoZXJhcGlzdCUyMHBvcnRyYWl0fGVufDB8MHx8fDE3ODYzOTA3Mjl8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (seed: string): string =>
  PHOTO[seed] ?? `https://picsum.photos/seed/${seed}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}
const ASSETS: Asset[] = [
  {
    id: IMG.hero,
    url: src('align-hero'),
    alt: 'A calm, bright chiropractic clinic with soft natural light',
  },
  {
    id: IMG.interior,
    url: src('align-interior'),
    alt: 'A quiet treatment room with an adjustment table',
  },
  { id: IMG.ren, url: src('align-ren'), alt: 'Dr. Ren Ishikawa, chiropractor' },
  { id: IMG.sol, url: src('align-sol'), alt: 'Dr. Sol Marín, chiropractor' },
  { id: IMG.mira, url: src('align-mira'), alt: 'Mira Novak, massage therapist' },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-chiro-wellness: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "align": near-white ground, soft-teal primary, warm-coral accent, slate ink ─
const align = defineTheme({
  name: 'align',
  type: { body: face('Inter', 'sans-serif'), head: face('Outfit', 'sans-serif') },
  shape: { selector: '0.625rem', field: '0.625rem', box: '0.875rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(98% 0.006 200)', // clean near-white
      'oklch(95% 0.01 200)', // soft mist
      'oklch(90% 0.014 200)', // hairline
      'oklch(30% 0.03 240)', // dark slate ink
    ],
    roles: {
      primary: 'oklch(66% 0.09 195)', // soft teal / blue-green
      secondary: 'oklch(40% 0.03 240)', // dark slate (readable micro-labels)
      accent: 'oklch(74% 0.11 42)', // warm coral / sand
      neutral: 'oklch(32% 0.025 240)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(24% 0.02 240)',
      'oklch(20% 0.018 240)',
      'oklch(16% 0.014 240)',
      'oklch(95% 0.006 200)',
    ],
    roles: {
      primary: 'oklch(74% 0.09 195)',
      secondary: 'oklch(78% 0.02 240)',
      accent: 'oklch(78% 0.11 42)',
      neutral: 'oklch(83% 0.015 240)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the booking spine (policies, chiropractors + rooms + hours, the menu) ──
const hours = (days: number[], startMinute: number, endMinute: number) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

const SCHEDULING = {
  policies: [
    {
      handle: 'align-standard',
      name: 'Standard booking',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [1440, 120],
      policyText:
        'Please give us at least 24 hours’ notice if you need to change or cancel — it lets us offer the time to someone else who needs relief. We’ll send a friendly reminder the day before and two hours ahead.',
    },
    {
      handle: 'align-no-show',
      name: 'Reserved-room hold',
      depositType: 'card_hold',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [1440, 120],
      policyText:
        'Longer visits reserve a treatment room and a provider just for you, so we hold a card on file — nothing is charged unless the appointment is missed without notice. Reschedule in time and the hold simply releases.',
    },
  ],
  resources: [
    {
      handle: 'dr-ren',
      name: 'Dr. Ren Ishikawa',
      kind: 'staff',
      skillTags: ['adjustment', 'exam', 'wellness'],
      windows: hours([1, 2, 3, 4, 5], 480, 1020), // Mon–Fri 8–5
    },
    {
      handle: 'dr-sol',
      name: 'Dr. Sol Marín',
      kind: 'staff',
      skillTags: ['adjustment', 'posture', 'wellness'],
      windows: hours([1, 2, 4, 5, 6], 540, 1080), // Mon, Tue, Thu–Sat 9–6
    },
    {
      handle: 'mira',
      name: 'Mira Novak',
      kind: 'staff',
      skillTags: ['massage', 'recovery'],
      windows: hours([2, 3, 4, 5], 600, 1140), // Tue–Fri 10–7
    },
    {
      handle: 'room-1',
      name: 'Treatment Room 1',
      kind: 'space',
      skillTags: ['room'],
      windows: hours([1, 2, 3, 4, 5, 6], 480, 1140), // Mon–Sat 8–7
    },
    {
      handle: 'room-2',
      name: 'Treatment Room 2',
      kind: 'space',
      skillTags: ['room'],
      windows: hours([1, 2, 3, 4, 5, 6], 480, 1140), // Mon–Sat 8–7
    },
  ],
  services: [
    {
      handle: 'new-patient-exam',
      name: 'New patient exam',
      description:
        'Your first visit: a thorough consultation, a gentle exam and a plan tailored to how you actually feel and move.',
      durationMinutes: 45,
      priceCents: 9500,
      bufferAfterMin: 10,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'provider', kind: 'staff', skillTags: ['exam'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['room'], count: 1 },
      ],
      policyHandle: 'align-no-show',
    },
    {
      handle: 'adjustment',
      name: 'Chiropractic adjustment',
      description:
        'A gentle, precise adjustment to ease tension and restore easy movement. The everyday visit most people come in for.',
      durationMinutes: 20,
      priceCents: 6500,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'provider', kind: 'staff', skillTags: ['adjustment'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['room'], count: 1 },
      ],
      policyHandle: 'align-standard',
    },
    {
      handle: 'wellness-visit',
      name: 'Wellness visit',
      description:
        'A relaxed maintenance visit for anyone on a plan — a check-in, an adjustment and small tweaks to keep you feeling good.',
      durationMinutes: 30,
      priceCents: 7500,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'provider', kind: 'staff', skillTags: ['wellness'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['room'], count: 1 },
      ],
      policyHandle: 'align-standard',
    },
    {
      handle: 'posture-assessment',
      name: 'Posture assessment',
      description:
        'A focused look at how you sit, stand and work — with simple, doable changes to take the strain off your neck and back.',
      durationMinutes: 40,
      priceCents: 8500,
      bufferAfterMin: 10,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'provider', kind: 'staff', skillTags: ['posture'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['room'], count: 1 },
      ],
      policyHandle: 'align-standard',
    },
    {
      handle: 'massage-add-on',
      name: 'Therapeutic massage',
      description:
        'A calming, tension-releasing massage — lovely on its own or added before an adjustment to help everything settle.',
      durationMinutes: 60,
      priceCents: 9000,
      bufferAfterMin: 10,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'provider', kind: 'staff', skillTags: ['massage'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['room'], count: 1 },
      ],
      policyHandle: 'align-standard',
    },
    {
      handle: 'follow-up',
      name: 'Follow-up adjustment',
      description:
        'A shorter return visit to keep your progress on track between wellness appointments.',
      durationMinutes: 15,
      priceCents: 5500,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'provider', kind: 'staff', skillTags: ['adjustment'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['room'], count: 1 },
      ],
      policyHandle: 'align-standard',
    },
    {
      handle: 'wellness-plan-consult',
      name: 'Wellness plan consult',
      description:
        'A free, no-pressure chat about a longer-term wellness plan — what it covers, what it costs, and whether it’s right for you.',
      durationMinutes: 20,
      priceCents: 0,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'provider', kind: 'staff', skillTags: ['wellness'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['room'], count: 1 },
      ],
      policyHandle: 'align-standard',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  photoHero({
    image: url(IMG.hero),
    alt: 'A calm, bright chiropractic clinic with soft natural light',
    title: 'Feel better, move easier',
    sub: 'Gentle, everyday chiropractic care — for the stiff neck, the aching back and the wellness routine that keeps them from coming back.',
    primary: { label: 'Book an appointment', href: '/book' },
    secondary: { label: 'See what we do', href: '/book' },
    overlay: 'dark',
  }),
  featureRow({
    items: [
      {
        title: 'Gentle, tailored adjustments',
        body: 'No cracking-you-into-shape surprises. Every adjustment is gentle, explained first, and matched to how your body actually feels that day.',
      },
      {
        title: 'Most insurance accepted',
        body: 'We take most major plans and make the paperwork painless. Not sure about yours? Ask when you book and we’ll check for you.',
      },
      {
        title: 'Same-week new patients',
        body: 'New here? You won’t wait weeks to be seen. Most new patients get an appointment within a few days.',
      },
      {
        title: 'Wellness plans that fit',
        body: 'Ongoing care shouldn’t break the bank. Simple, flexible plans keep regular visits affordable once you’re feeling good.',
      },
    ],
  }),
  serviceMenu({
    heading: 'What we do',
    intro: 'A few of the appointments people book most. Full prices and live availability are on the booking page.',
    surface: 'muted',
    columns: 2,
    items: [
      {
        name: 'New patient exam',
        priceCents: 9500,
        durationMin: 45,
        desc: 'A consultation, a gentle exam and a plan built around you.',
      },
      {
        name: 'Chiropractic adjustment',
        priceCents: 6500,
        durationMin: 20,
        desc: 'A gentle, precise adjustment to ease tension.',
      },
      {
        name: 'Therapeutic massage',
        priceCents: 9000,
        durationMin: 60,
        desc: 'A calming, tension-releasing massage.',
      },
      {
        name: 'Posture assessment',
        priceCents: 8500,
        durationMin: 40,
        desc: 'Simple changes to take the strain off your neck and back.',
      },
    ],
    cta: { label: 'See everything & book', href: '/book' },
  }),
  splitFeature({
    image: url(IMG.interior),
    alt: 'A quiet treatment room with an adjustment table',
    heading: 'Care for your whole self, not just the sore spot',
    body: [
      'Pain rarely comes from one place. We look at how you sit, sleep, move and work — then treat the cause, not just the ache, so relief actually lasts.',
      'It’s a calm, unhurried approach: gentle adjustments, honest advice, and a wellness plan you can keep up with. You leave knowing what to do at home, not just what happened in the room.',
    ],
    cta: { label: 'Book an appointment', href: '/book' },
  }),
  teamRow({
    heading: 'Who you’ll see',
    intro: 'A small, friendly team — book by name and see the same person each visit.',
    members: [
      {
        name: 'Dr. Ren Ishikawa',
        role: 'Chiropractor',
        image: url(IMG.ren),
        alt: 'Dr. Ren Ishikawa, chiropractor',
        bio: 'Gentle adjustments and thorough new-patient exams. Ren leads the clinic.',
      },
      {
        name: 'Dr. Sol Marín',
        role: 'Chiropractor',
        image: url(IMG.sol),
        alt: 'Dr. Sol Marín, chiropractor',
        bio: 'Posture, everyday pain relief and wellness care that fits real life.',
      },
      {
        name: 'Mira Novak',
        role: 'Massage therapist',
        image: url(IMG.mira),
        alt: 'Mira Novak, massage therapist',
        bio: 'Calming therapeutic massage — lovely alone or before an adjustment.',
      },
    ],
  }),
  testimonial({
    quote:
      'I came in barely able to turn my neck after months of desk work. A few gentle visits and some posture tips later, I’m sleeping through the night again. Calmest clinic I’ve ever been to.',
    attribution: 'Devon, patient since 2024',
  }),
  bookingCta({
    title: 'Ready to feel better?',
    sub: 'Pick a service, choose your provider and see live times. It takes about a minute.',
    cta: { label: 'Book an appointment', href: '/book' },
  }),
];

const BOOK_INTRO = [
  photoHero({
    image: url(IMG.interior),
    alt: 'A quiet treatment room with an adjustment table',
    title: 'Book an appointment',
    sub: 'Choose a service to see prices and live availability, then pick your provider and a time that works for you.',
    primary: { label: 'See services below', href: '/book' },
    overlay: 'darker',
    align: 'start',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.hero),
    alt: 'A calm, bright chiropractic clinic with soft natural light',
    heading: 'About Align Chiropractic',
    body: [
      'We opened Align Chiropractic to make everyday care feel calm and approachable — no jargon, no pressure, and no one-size-fits-all cracking. Just gentle adjustments and honest advice from people who listen.',
      'Whether you’re here for a stubborn ache, better posture, or a wellness routine that keeps you moving well, we build the plan around you — and we’d rather see you less often and feeling great than book you in forever.',
    ],
    cta: { label: 'Book an appointment', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'How we work',
    items: [
      {
        title: 'We listen first',
        body: 'Every visit starts with a real conversation about how you feel, how you move, and what you actually want to get back to.',
      },
      {
        title: 'Gentle and explained',
        body: 'Nothing happens by surprise. We talk you through each adjustment, keep it gentle, and go at a pace that feels right.',
      },
      {
        title: 'Yours to keep',
        body: 'You’ll leave with simple things to do at home — so the relief holds up between visits, not just in the chair.',
      },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Visit the clinic',
    address: ['Align Chiropractic', '204 Marigold Avenue', 'Suite 5 · Boulder, CO 80302'],
    mapLocation: '204 Marigold Avenue, Boulder, CO 80302',
    hours: [
      { day: 'Monday – Friday', time: '8:00 – 6:00' },
      { day: 'Saturday', time: '9:00 – 2:00' },
      { day: 'Sunday', time: 'Closed' },
    ],
  }),
  bookingCta({
    title: 'Rather book than call?',
    sub: 'See live availability and reserve your time online — no phone tag.',
    surface: 'muted',
    cta: { label: 'Book an appointment', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-chiro-wellness',
  name: 'Chiropractic (Wellness)',
  summary:
    'A calm, clean chiropractic-clinic site — a soft-teal palette, a warm-coral accent and a bright near-white ground, built around gentle everyday care. Installs a working booking flow for adjustments, exams, posture and massage: two chiropractors and a massage therapist you book by name, two treatment rooms, and appointments that reserve a provider AND a room. Ships as "Align Chiropractic", a modern wellness clinic.',
  tagline: 'A calm, wellness-first template for chiropractors — book online from day one.',
  industry: 'Chiropractic',
  sortWeight: 56,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'Align Chiropractic', tagline: 'Gentle care, everyday relief.' },
  theme: align,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Align Chiropractic — gentle, everyday care',
      description:
        'Align Chiropractic is a calm wellness clinic for gentle adjustments, posture, everyday pain relief and massage. Book your chiropractor online.',
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
