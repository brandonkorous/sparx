// sparx-vet-modern — "Fauna Veterinary", a modern, calm, fear-free pet-WELLNESS practice.
//
// The elevated, holistic-wellness lane: sage and cream, a refined serif display over a
// humanist sans, soft unhurried photography, and a whole-pet / low-stress structure —
// preventive & integrative care, nutrition, telehealth, wellness plans. Deliberately the
// OTHER side of the second vet template (a warm, friendly neighbourhood clinic): this one
// is quiet, considered and modern. Same booking spine (provider + exam room), a different
// business — a visit you book online in about a minute.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-vet-modern.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-vet-modern/**" \
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
  hero: 'vet-modern-hero',
  clinic: 'vet-modern-clinic',
  philosophy: 'vet-modern-philosophy',
  wren: 'vet-modern-wren',
  sol: 'vet-modern-sol',
  marisol: 'vet-modern-marisol',
} as const;

const PHOTO: Record<string, string> = {
  "fauna-clinic": "https://images.unsplash.com/photo-1644675272883-0c4d582528d8?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bW9kZXJuJTIwdmV0JTIwY2xpbmljJTIwaW50ZXJpb3J8ZW58MHwwfHx8MTc4NjM5MDA5NXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "fauna-philosophy": "https://images.unsplash.com/photo-1596272875729-ed2ff7d6d9c5?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dmV0ZXJpbmFyaWFuJTIwd2l0aCUyMGNhdHxlbnwwfDB8fHwxNzg2MzkwMDk4fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "fauna-wren": "https://images.unsplash.com/photo-1673865641073-4479f93a7776?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjB2ZXRlcmluYXJpYW4lMjBwb3J0cmFpdHxlbnwwfDB8fHwxNzg2MzkwMDgzfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "fauna-sol": "https://images.unsplash.com/photo-1700665537604-412e89a285c3?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dmV0ZXJpbmFyaWFuJTIwcG9ydHJhaXR8ZW58MHwwfHx8MTc4NjM5MDEwMHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "fauna-marisol": "https://images.unsplash.com/photo-1659353888906-adb3e0041693?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjBkb2N0b3IlMjBwb3J0cmFpdHxlbnwwfDB8fHwxNzg2Mzg5MzExfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "fauna-hero": "https://images.unsplash.com/photo-1772081960353-2ca7b181440c?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dmV0ZXJpbmFyeSUyMGNsaW5pYyUyMGRvZ3xlbnwwfDB8fHwxNzg2MzkwMTIxfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (seed: string): string =>
  PHOTO[seed] ?? `https://picsum.photos/seed/${seed}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}
const ASSETS: Asset[] = [
  { id: IMG.hero, url: src('fauna-hero'), alt: 'A calm, sunlit veterinary studio with a relaxed dog resting on a soft mat' },
  { id: IMG.clinic, url: src('fauna-clinic'), alt: 'A quiet, low-stress exam room in warm neutrals and greenery' },
  { id: IMG.philosophy, url: src('fauna-philosophy'), alt: 'A vet gently examining a content cat on a towel-lined table' },
  { id: IMG.wren, url: src('fauna-wren'), alt: 'Dr. Wren Delgado, integrative & wellness veterinarian' },
  { id: IMG.sol, url: src('fauna-sol'), alt: 'Dr. Sol Okafor, primary-care veterinarian' },
  { id: IMG.marisol, url: src('fauna-marisol'), alt: 'Dr. Marisol Reyes, wellness & telehealth veterinarian' },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-vet-modern: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "fauna": sage/eucalyptus primary, warm-clay accent, cream ground, dark ink ──
const fauna = defineTheme({
  name: 'fauna',
  type: { body: face('Inter', 'sans-serif'), head: face('Fraunces', 'serif') },
  shape: { selector: '0.5rem', field: '0.5rem', box: '0.75rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(97% 0.013 120)', // warm greige-cream
      'oklch(94% 0.016 125)', // oat
      'oklch(88% 0.018 130)', // hairline
      'oklch(28% 0.02 150)', // deep green-charcoal ink
    ],
    roles: {
      primary: 'oklch(60% 0.068 150)', // sage / eucalyptus green
      secondary: 'oklch(38% 0.028 152)', // dark green-ink (micro-labels pass contrast on cream)
      accent: 'oklch(70% 0.072 55)', // warm clay
      neutral: 'oklch(30% 0.02 150)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(24% 0.02 155)',
      'oklch(20% 0.016 155)',
      'oklch(16% 0.012 155)',
      'oklch(95% 0.012 115)',
    ],
    roles: {
      primary: 'oklch(74% 0.08 150)',
      secondary: 'oklch(78% 0.02 130)',
      accent: 'oklch(77% 0.08 55)',
      neutral: 'oklch(83% 0.015 130)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the booking spine (policies, vets + exam rooms, the appointment menu) ──
const hours = (days: number[], startMinute: number, endMinute: number) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

const SCHEDULING = {
  policies: [
    {
      handle: 'fauna-standard',
      name: 'Standard booking',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [1440, 120],
      policyText:
        'Please give us at least 24 hours’ notice to change or cancel a visit. We send a reminder the day before and two hours ahead, so nothing sneaks up on you.',
    },
    {
      handle: 'wellness-plan',
      name: 'Wellness plan & no-show',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [2880, 1440, 120],
      policyText:
        'Longer wellness and senior visits are booked as protected time with your vet. If you need to change one, 24 hours’ notice keeps it free — repeated same-day no-shows may carry a small fee so the room stays open for another pet who needs it.',
    },
  ],
  resources: [
    {
      handle: 'dr-wren',
      name: 'Dr. Wren Delgado',
      kind: 'staff',
      skillTags: ['wellness', 'integrative', 'nutrition'],
      windows: hours([1, 2, 3, 4], 540, 1020), // Mon–Thu 9–5
    },
    {
      handle: 'dr-sol',
      name: 'Dr. Sol Okafor',
      kind: 'staff',
      skillTags: ['exam', 'sick', 'senior'],
      windows: hours([2, 3, 4, 5, 6], 480, 960), // Tue–Sat 8–4
    },
    {
      handle: 'dr-marisol',
      name: 'Dr. Marisol Reyes',
      kind: 'staff',
      skillTags: ['exam', 'wellness', 'telehealth'],
      windows: hours([1, 3, 4, 5], 600, 1080), // Mon, Wed–Fri 10–6
    },
    {
      handle: 'exam-room-willow',
      name: 'Willow Exam Room',
      kind: 'space',
      skillTags: ['exam-room'],
      windows: hours([1, 2, 3, 4, 5, 6], 480, 1080), // Mon–Sat 8–6
    },
    {
      handle: 'exam-room-fern',
      name: 'Fern Exam Room',
      kind: 'space',
      skillTags: ['exam-room'],
      windows: hours([1, 2, 3, 4, 5, 6], 480, 1080), // Mon–Sat 8–6
    },
    {
      handle: 'virtual-room',
      name: 'Telehealth Room',
      kind: 'space',
      skillTags: ['exam-room'],
      windows: hours([1, 2, 3, 4, 5], 540, 1140), // Mon–Fri 9–7
    },
  ],
  services: [
    {
      handle: 'wellness-visit',
      name: 'Wellness visit',
      description:
        'An unhurried preventive check-up — nose to tail, vaccines if they’re due, and a calm conversation about how your pet is doing at home.',
      durationMinutes: 30,
      priceCents: 6500,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'provider', kind: 'staff', skillTags: ['wellness'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['exam-room'], count: 1 },
      ],
      policyHandle: 'fauna-standard',
    },
    {
      handle: 'new-patient-consult',
      name: 'New patient consult',
      description:
        'A relaxed first meeting for you and your pet — we review history, get to know each other with no rush, and set a plan together. Always free.',
      durationMinutes: 45,
      priceCents: 0,
      bufferAfterMin: 10,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'provider', kind: 'staff', skillTags: ['exam'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['exam-room'], count: 1 },
      ],
      policyHandle: 'fauna-standard',
    },
    {
      handle: 'nutrition-consult',
      name: 'Nutrition consult',
      description:
        'A sit-down about food, weight and gut health — honest, practical guidance tailored to your dog or cat, with no upsell. Free introductory session.',
      durationMinutes: 30,
      priceCents: 0,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'provider', kind: 'staff', skillTags: ['nutrition'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['exam-room'], count: 1 },
      ],
      policyHandle: 'fauna-standard',
    },
    {
      handle: 'sick-visit',
      name: 'Sick visit',
      description:
        'Something’s off? A focused, gentle exam to find out what’s wrong and get your pet comfortable, with clear next steps and honest pricing.',
      durationMinutes: 30,
      priceCents: 8500,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'provider', kind: 'staff', skillTags: ['sick'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['exam-room'], count: 1 },
      ],
      policyHandle: 'fauna-standard',
    },
    {
      handle: 'senior-wellness',
      name: 'Senior wellness',
      description:
        'Extra time and care for older pets — mobility, comfort and quality of life, plus the bloodwork and screening that catch changes early.',
      durationMinutes: 60,
      priceCents: 14000,
      bufferAfterMin: 10,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'provider', kind: 'staff', skillTags: ['senior'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['exam-room'], count: 1 },
      ],
      policyHandle: 'wellness-plan',
    },
    {
      handle: 'telehealth-consult',
      name: 'Telehealth consult',
      description:
        'A quick video visit for questions, follow-ups and small worries — real advice from your vet without a car ride or a stressed carrier.',
      durationMinutes: 20,
      priceCents: 4000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'provider', kind: 'staff', skillTags: ['telehealth'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['exam-room'], count: 1 },
      ],
      policyHandle: 'fauna-standard',
    },
    {
      handle: 'integrative-consult',
      name: 'Integrative consult',
      description:
        'A whole-pet session that blends conventional medicine with supportive therapies — for chronic issues, recovery, or simply thriving longer.',
      durationMinutes: 45,
      priceCents: 9500,
      bufferAfterMin: 10,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'provider', kind: 'staff', skillTags: ['integrative'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['exam-room'], count: 1 },
      ],
      policyHandle: 'wellness-plan',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  photoHero({
    image: url(IMG.hero),
    alt: 'A calm, sunlit veterinary studio with a relaxed dog resting on a soft mat',
    title: 'Calm, modern care for the pets you love',
    sub: 'A fear-free, whole-pet practice for dogs and cats — preventive medicine, nutrition and gentle, unhurried visits that leave everyone a little calmer.',
    primary: { label: 'Book a visit', href: '/book' },
    secondary: { label: 'See our care', href: '/book' },
    overlay: 'dark',
  }),
  featureRow({
    items: [
      {
        title: 'Fear-free, always',
        body: 'Certified fear-free handling, soft rooms and treats first. We work at your pet’s pace so a visit feels like a check-in, not a fight.',
      },
      {
        title: 'Preventive & integrative',
        body: 'We treat the whole animal — conventional medicine paired with nutrition and supportive care, aimed at keeping pets well, not just fixing what’s broken.',
      },
      {
        title: 'Unhurried visits',
        body: 'No packed waiting room, no rushing you out the door. Real time with your vet to talk through what your pet actually needs.',
      },
      {
        title: 'Plans & telehealth',
        body: 'Wellness plans that spread care across the year, plus video visits for the small questions — so help is there without the stressful trip.',
      },
    ],
  }),
  serviceMenu({
    heading: 'Ways to visit',
    intro: 'A few of the appointments we see most. Full prices and live availability are on the booking page.',
    surface: 'muted',
    columns: 2,
    items: [
      { name: 'Wellness visit', priceCents: 6500, durationMin: 30, desc: 'An unhurried preventive check-up, nose to tail.' },
      { name: 'New patient consult', priceCents: 0, durationMin: 45, desc: 'A relaxed first meeting and a plan together. Free.' },
      { name: 'Nutrition consult', priceCents: 0, durationMin: 30, desc: 'Practical food and weight guidance, no upsell.' },
      { name: 'Senior wellness', priceCents: 14000, durationMin: 60, desc: 'Extra time and screening for older pets.' },
    ],
    cta: { label: 'See everything & book', href: '/book' },
  }),
  splitFeature({
    image: url(IMG.philosophy),
    alt: 'A vet gently examining a content cat on a towel-lined table',
    heading: 'The whole pet, at their pace',
    body: [
      'Fauna was built around one idea: a calmer visit is a better visit. Our team is fear-free certified, which means treats before needles, quiet rooms, and never forcing an anxious animal through something they’re not ready for.',
      'It’s a whole-pet way of working — we look at nutrition, comfort and behaviour alongside the medicine, because the goal isn’t just treating illness. It’s helping your dog or cat thrive for years.',
    ],
    cta: { label: 'Book a visit', href: '/book' },
  }),
  teamRow({
    heading: 'The vets you’ll see',
    intro: 'Book by name — you and your pet get to know the same faces over time.',
    members: [
      { name: 'Dr. Wren Delgado', role: 'Integrative & wellness', image: url(IMG.wren), alt: 'Dr. Wren Delgado, integrative & wellness veterinarian', bio: 'Preventive and integrative medicine, with a soft spot for nutrition and gut health.' },
      { name: 'Dr. Sol Okafor', role: 'Primary care', image: url(IMG.sol), alt: 'Dr. Sol Okafor, primary-care veterinarian', bio: 'Everyday exams, sick visits and senior care — calm hands and straight answers.' },
      { name: 'Dr. Marisol Reyes', role: 'Wellness & telehealth', image: url(IMG.marisol), alt: 'Dr. Marisol Reyes, wellness & telehealth veterinarian', bio: 'Wellness visits and video consults, so small worries get answered fast.' },
    ],
  }),
  testimonial({
    quote: 'First vet where my rescue didn’t shake the whole time. They let her sniff around, took it slow, and we actually got everything done. She trots in now.',
    attribution: 'Devi & Juniper, clients since 2024',
    surface: 'muted',
  }),
  bookingCta({
    title: 'Ready to book a visit?',
    sub: 'Choose an appointment, pick your vet and see live times. It takes about a minute.',
    cta: { label: 'Book a visit', href: '/book' },
  }),
];

const BOOK_INTRO = [
  photoHero({
    image: url(IMG.clinic),
    alt: 'A quiet, low-stress exam room in warm neutrals and greenery',
    title: 'Book a visit',
    sub: 'Choose an appointment type to see prices and live availability, then pick your vet and a time that suits you and your pet.',
    primary: { label: 'See appointments below', href: '/book' },
    overlay: 'darker',
    align: 'start',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.hero),
    alt: 'A calm, sunlit veterinary studio with a relaxed dog resting on a soft mat',
    heading: 'About Fauna Veterinary',
    body: [
      'We opened Fauna to practice the kind of medicine we always wanted for our own animals — calm, thorough, and centred on the whole pet rather than a single problem.',
      'That means fear-free handling as the default, real time in every appointment, and honest guidance on food, prevention and comfort. Fewer stressed visits, healthier pets, and owners who actually understand the plan.',
    ],
    cta: { label: 'Book a visit', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'How we care',
    items: [
      { title: 'Fear-free first', body: 'Every visit is paced for your pet — treats, patience and gentle handling, never a wrestling match.' },
      { title: 'Prevention over patching', body: 'Wellness plans, nutrition and early screening keep problems small, so care costs less and pets feel better.' },
      { title: 'Clear, honest plans', body: 'You’ll always leave knowing what we found, what it means, and what it costs — no jargon, no pressure.' },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Visit the practice',
    address: ['Fauna Veterinary', '412 Meadowlark Avenue', 'Suite 3 · Asheville, NC 28801'],
    mapLocation: '412 Meadowlark Avenue, Asheville, NC 28801',
    hours: [
      { day: 'Monday – Friday', time: '8:00 – 6:00' },
      { day: 'Saturday', time: '8:00 – 4:00' },
      { day: 'Sunday', time: 'Closed' },
    ],
  }),
  bookingCta({
    title: 'Rather book than call?',
    sub: 'See live availability and reserve your pet’s time online — no phone tag, no hold music.',
    surface: 'muted',
    cta: { label: 'Book a visit', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-vet-modern',
  name: 'Veterinary (Modern)',
  summary:
    'A calm, modern veterinary-wellness site — a sage-and-cream palette, a refined serif display and soft, unhurried photography. Installs a working booking flow for fear-free care: real appointment types (wellness, nutrition, telehealth, senior), three vets you book by name plus two calm exam rooms as resources, and a wellness-plan policy. Ships as "Fauna Veterinary", a whole-pet, fear-free practice for dogs and cats.',
  tagline: 'A calm, fear-free template for modern vet practices — book online from day one.',
  industry: 'Veterinary',
  sortWeight: 61,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'Fauna Veterinary', tagline: 'Calm, whole-pet care.' },
  theme: fauna,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Fauna Veterinary — calm, fear-free pet care',
      description:
        'Fauna Veterinary is a modern, fear-free practice for dogs and cats — wellness visits, nutrition, senior care and telehealth. Book your vet online.',
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
