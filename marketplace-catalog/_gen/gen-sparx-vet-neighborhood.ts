// sparx-vet-neighborhood — "Cedar Paws Veterinary", a friendly NEIGHBORHOOD vet clinic.
//
// The warm, all-pets family clinic: a caring teal-green primary, a warm coral accent, a
// clean warm-white ground and a friendly rounded sans display over Inter. Full-service —
// wellness exams, vaccinations, sick visits, dental, surgery and senior care for dogs &
// cats — with online booking as the whole point. Deliberately the FRIENDLY, approachable
// sibling of the modern/holistic pet-wellness template (sage, refined): same booking
// spine, a warmer, softer business your pet's second family would run.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @wizeworks/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-vet-neighborhood.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-vet-neighborhood/**" \
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
  hero: 'vet-neighborhood-hero',
  care: 'vet-neighborhood-care',
  maya: 'vet-neighborhood-maya',
  sam: 'vet-neighborhood-sam',
  jordan: 'vet-neighborhood-jordan',
} as const;

const PHOTO: Record<string, string> = {
  "cedarpaws-hero": "https://images.unsplash.com/photo-1623387641168-d9803ddd3f35?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dmV0ZXJpbmFyaWFuJTIwZG9nJTIwY2F0fGVufDB8MHx8fDE3ODYzOTAwNzd8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "cedarpaws-care": "https://images.unsplash.com/photo-1596272875729-ed2ff7d6d9c5?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dmV0JTIwZXhhbWluaW5nJTIwcGV0fGVufDB8MHx8fDE3ODYzOTAwODB8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "cedarpaws-maya": "https://images.unsplash.com/photo-1673865641073-4479f93a7776?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjB2ZXRlcmluYXJpYW4lMjBwb3J0cmFpdHxlbnwwfDB8fHwxNzg2MzkwMDgzfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "cedarpaws-sam": "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dmV0ZXJpbmFyaWFuJTIwcG9ydHJhaXQlMjBtYW58ZW58MHwwfHx8MTc4NjM5MDA4Nnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "cedarpaws-jordan": "https://images.unsplash.com/photo-1700665537604-412e89a285c3?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dmV0JTIwdGVjaG5pY2lhbiUyMHBvcnRyYWl0fGVufDB8MHx8fDE3ODYzOTAwODl8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
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
    url: src('cedarpaws-hero'),
    alt: 'A happy dog resting a paw on a caring veterinarian during a check-up',
  },
  {
    id: IMG.care,
    url: src('cedarpaws-care'),
    alt: 'A veterinarian gently holding a cat in a bright, calm exam room',
  },
  { id: IMG.maya, url: src('cedarpaws-maya'), alt: 'Dr. Maya Ellison, veterinarian' },
  { id: IMG.sam, url: src('cedarpaws-sam'), alt: 'Dr. Sam Reyes, veterinarian' },
  { id: IMG.jordan, url: src('cedarpaws-jordan'), alt: 'Jordan Blake, veterinary technician' },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-vet-neighborhood: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "cedarpaws": warm-white ground, caring teal primary, warm-coral accent ─────
const cedarpaws = defineTheme({
  name: 'cedarpaws',
  type: { body: face('Inter', 'sans-serif'), head: face('Nunito', 'sans-serif') },
  shape: { selector: '0.75rem', field: '0.75rem', box: '1rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(98% 0.008 95)', // warm white
      'oklch(95% 0.012 90)', // soft cream
      'oklch(90% 0.015 85)', // hairline
      'oklch(27% 0.02 210)', // deep slate ink
    ],
    roles: {
      primary: 'oklch(58% 0.10 178)', // caring teal-green
      secondary: 'oklch(36% 0.025 215)', // dark slate (readable micro-labels)
      accent: 'oklch(70% 0.14 42)', // warm coral
      neutral: 'oklch(30% 0.02 210)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(24% 0.02 215)',
      'oklch(20% 0.018 215)',
      'oklch(16% 0.015 215)',
      'oklch(95% 0.01 95)',
    ],
    roles: {
      primary: 'oklch(72% 0.11 178)',
      secondary: 'oklch(80% 0.02 210)',
      accent: 'oklch(76% 0.13 44)',
      neutral: 'oklch(82% 0.015 210)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the booking spine (policies, vets + tech + exam rooms, appointments) ──
const hours = (days: number[], startMinute: number, endMinute: number) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

const SCHEDULING = {
  policies: [
    {
      handle: 'vet-standard',
      name: 'Standard appointment',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [1440, 120],
      policyText:
        'Please give us at least 24 hours’ notice to change or cancel so we can offer the time to another pet family. We’ll text and email a reminder the day before and two hours ahead.',
    },
    {
      handle: 'no-show-hold',
      name: 'Reserved-time hold',
      depositType: 'card_hold',
      depositAmountCents: 3500,
      cancellationWindowHours: 24,
      reminderOffsetsMin: [2880, 1440, 120],
      policyText:
        'Longer appointments hold a card on file to reserve the room and the doctor’s time. You’re only charged for a same-day cancellation or a no-show — otherwise the hold is released after your visit.',
    },
  ],
  resources: [
    {
      handle: 'dr-maya',
      name: 'Dr. Maya Ellison',
      kind: 'staff',
      skillTags: ['exam', 'sick', 'surgery', 'dental'],
      windows: hours([1, 2, 3, 4, 5], 480, 1020), // Mon–Fri 8–5
    },
    {
      handle: 'dr-sam',
      name: 'Dr. Sam Reyes',
      kind: 'staff',
      skillTags: ['exam', 'sick', 'senior', 'dental'],
      windows: hours([1, 2, 4, 5, 6], 540, 1080), // Mon, Tue, Thu, Fri 9–6 + Sat
    },
    {
      handle: 'tech-jordan',
      name: 'Jordan Blake',
      kind: 'staff',
      skillTags: ['vaccine', 'nail', 'wellness'],
      windows: hours([1, 2, 3, 4, 5], 480, 960), // Mon–Fri 8–4
    },
    {
      handle: 'exam-room-1',
      name: 'Exam Room 1',
      kind: 'space',
      skillTags: ['exam-room'],
      windows: hours([1, 2, 3, 4, 5, 6], 480, 1080), // Mon–Sat 8–6
    },
    {
      handle: 'exam-room-2',
      name: 'Exam Room 2',
      kind: 'space',
      skillTags: ['exam-room'],
      windows: hours([1, 2, 3, 4, 5, 6], 480, 1080),
    },
    {
      handle: 'exam-room-3',
      name: 'Exam Room 3',
      kind: 'space',
      skillTags: ['exam-room'],
      windows: hours([1, 2, 3, 4, 5], 480, 1020),
    },
  ],
  services: [
    {
      handle: 'wellness-exam',
      name: 'Wellness exam',
      description:
        'A head-to-tail check-up for a healthy dog or cat — weight, heart, teeth, coat and a plan to keep them feeling their best.',
      durationMinutes: 30,
      priceCents: 6500,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'provider', kind: 'staff', skillTags: ['exam'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['exam-room'], count: 1 },
      ],
      policyHandle: 'vet-standard',
    },
    {
      handle: 'vaccination-visit',
      name: 'Vaccination visit',
      description:
        'Core and lifestyle vaccines kept up to date, given gently by our tech with plenty of treats and patience.',
      durationMinutes: 20,
      priceCents: 4500,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'provider', kind: 'staff', skillTags: ['vaccine'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['exam-room'], count: 1 },
      ],
      policyHandle: 'vet-standard',
    },
    {
      handle: 'sick-visit',
      name: 'Sick visit',
      description:
        'Not quite themselves? Same-day appointments for the sniffles, tummy troubles, limps and everything that just seems off.',
      durationMinutes: 30,
      priceCents: 8000,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'provider', kind: 'staff', skillTags: ['sick'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['exam-room'], count: 1 },
      ],
      policyHandle: 'vet-standard',
    },
    {
      handle: 'new-patient-exam',
      name: 'New patient exam',
      description:
        'A longer first visit so we can meet your pet, go over their history, and start their records off right.',
      durationMinutes: 45,
      priceCents: 9500,
      bufferAfterMin: 10,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'provider', kind: 'staff', skillTags: ['exam'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['exam-room'], count: 1 },
      ],
      policyHandle: 'vet-standard',
    },
    {
      handle: 'senior-wellness',
      name: 'Senior wellness',
      description:
        'A gentle, thorough check-in for older pets — mobility, weight, bloodwork and comfort, so their golden years stay easy.',
      durationMinutes: 45,
      priceCents: 12000,
      bufferAfterMin: 10,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'provider', kind: 'staff', skillTags: ['senior'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['exam-room'], count: 1 },
      ],
      policyHandle: 'vet-standard',
    },
    {
      handle: 'dental-cleaning',
      name: 'Dental cleaning',
      description:
        'A full dental under anesthesia with pre-op bloodwork — scaling, polishing and a look under the gumline for a fresher, healthier mouth.',
      durationMinutes: 90,
      priceCents: 34000,
      bufferAfterMin: 15,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'provider', kind: 'staff', skillTags: ['dental'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['exam-room'], count: 1 },
      ],
      policyHandle: 'no-show-hold',
    },
    {
      handle: 'nail-trim',
      name: 'Nail trim',
      description:
        'A quick, low-stress nail trim with our tech — in and out, no exam needed. Walk-ins welcome when we can fit you in.',
      durationMinutes: 20,
      priceCents: 2500,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'provider', kind: 'staff', skillTags: ['nail'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['exam-room'], count: 1 },
      ],
      policyHandle: 'vet-standard',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  photoHero({
    image: url(IMG.hero),
    alt: 'A happy dog resting a paw on a caring veterinarian during a check-up',
    title: 'Your pet’s second family',
    sub: 'A friendly neighborhood clinic for dogs and cats — wellness, vaccines, sick visits, dental and senior care, all under one warm roof.',
    primary: { label: 'Book an appointment', href: '/book' },
    secondary: { label: 'See our services', href: '/book' },
    overlay: 'dark',
  }),
  featureRow({
    items: [
      {
        title: 'Compassionate care',
        body: 'Gentle hands, calm rooms and all the time your pet needs. We treat every animal like our own — because to us, they are.',
      },
      {
        title: 'Same-day sick visits',
        body: 'When something’s off, you shouldn’t have to wait days. We hold room every morning for pets who need to be seen now.',
      },
      {
        title: 'Dogs & cats welcome',
        body: 'From a wiggly new puppy to a wise old cat, we care for the whole family — and keep the visit as low-stress as we can.',
      },
      {
        title: 'Clear, honest pricing',
        body: 'You’ll always know the cost before we begin. No surprises, no upsells — just straight answers and fair prices.',
      },
    ],
  }),
  serviceMenu({
    heading: 'Ways we can help',
    intro: 'A few of the appointments we book most. Full prices and live openings are on the booking page.',
    surface: 'muted',
    columns: 2,
    items: [
      {
        name: 'Wellness exam',
        priceCents: 6500,
        durationMin: 30,
        desc: 'A head-to-tail check-up to keep them feeling their best.',
      },
      {
        name: 'Vaccination visit',
        priceCents: 4500,
        durationMin: 20,
        desc: 'Core and lifestyle vaccines, given gently.',
      },
      {
        name: 'Sick visit',
        priceCents: 8000,
        durationMin: 30,
        desc: 'Same-day help when your pet isn’t themselves.',
      },
      {
        name: 'Senior wellness',
        priceCents: 12000,
        durationMin: 45,
        desc: 'Thorough, gentle care for older pets.',
      },
    ],
    cta: { label: 'See everything & book', href: '/book' },
  }),
  splitFeature({
    image: url(IMG.care),
    alt: 'A veterinarian gently holding a cat in a bright, calm exam room',
    heading: 'Care that starts with listening',
    body: [
      'Cedar Paws is a neighborhood clinic, not a rush-you-through hospital. We keep the day unhurried so every visit gets a real conversation — about your pet, your worries, and what will actually help.',
      'You’ll see doctors and techs who remember your pet’s name, know their history, and explain everything in plain language. That’s the whole idea: fewer surprises, more trust, and a team that’s genuinely on your side.',
    ],
    cta: { label: 'Book an appointment', href: '/book' },
  }),
  teamRow({
    heading: 'Meet the team',
    intro: 'The doctors and techs who’ll get to know your pet by name.',
    members: [
      {
        name: 'Dr. Maya Ellison',
        role: 'Veterinarian',
        image: url(IMG.maya),
        alt: 'Dr. Maya Ellison, veterinarian',
        bio: 'Surgery, dentistry and everyday wellness. Maya founded Cedar Paws to do medicine slowly and kindly.',
      },
      {
        name: 'Dr. Sam Reyes',
        role: 'Veterinarian',
        image: url(IMG.sam),
        alt: 'Dr. Sam Reyes, veterinarian',
        bio: 'A soft spot for senior pets and the anxious ones — the cats who hide and the dogs who shake.',
      },
      {
        name: 'Jordan Blake',
        role: 'Veterinary technician',
        image: url(IMG.jordan),
        alt: 'Jordan Blake, veterinary technician',
        bio: 'Vaccines, nail trims and treat-forward visits. Jordan makes the hard days a little easier.',
      },
    ],
  }),
  testimonial({
    quote:
      'My old lab was terrified of the vet until we found Cedar Paws. They sat on the floor with him, took their time, and caught his kidney issue early. I don’t know where we’d be without them.',
    attribution: 'Dana & Barkley, clients since 2022',
  }),
  bookingCta({
    title: 'Ready to book your pet’s visit?',
    sub: 'Pick an appointment type, choose your doctor and see live openings. It takes about a minute.',
    cta: { label: 'Book an appointment', href: '/book' },
  }),
];

const BOOK_INTRO = [
  photoHero({
    image: url(IMG.care),
    alt: 'A veterinarian gently holding a cat in a bright, calm exam room',
    title: 'Book your pet’s appointment',
    sub: 'Choose an appointment type to see prices and live openings, then pick your doctor and a time that works.',
    primary: { label: 'See appointment types below', href: '/book' },
    overlay: 'darker',
    align: 'start',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.hero),
    alt: 'A happy dog resting a paw on a caring veterinarian during a check-up',
    heading: 'About Cedar Paws',
    body: [
      'We opened Cedar Paws to be the kind of clinic we’d want for our own pets — warm, unhurried, and honest. A place where you’re greeted by name, where the exam room feels calm, and where nobody makes you feel rushed or talked-down-to.',
      'We’re a full-service neighborhood practice for dogs and cats: wellness and vaccines, sick and same-day visits, dentistry, surgery and gentle senior care. Whatever your pet needs, we’ll walk through it together.',
    ],
    cta: { label: 'Book an appointment', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'How we care',
    items: [
      {
        title: 'Low-stress by design',
        body: 'Quiet rooms, gentle handling and treats on hand — we work at your pet’s pace to make the visit easier on everyone.',
      },
      {
        title: 'Plain-language answers',
        body: 'We explain what we see, what it means and what your options are — no jargon, no pressure, just clear guidance you can trust.',
      },
      {
        title: 'Here for the long haul',
        body: 'From first puppy shots to the tender senior years, we’re the steady team that knows your pet through every stage of life.',
      },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Visit the clinic',
    address: ['Cedar Paws Veterinary', '412 Maple Row', 'Asheville, NC 28801'],
    mapLocation: '412 Maple Row, Asheville, NC 28801',
    hours: [
      { day: 'Monday – Friday', time: '8:00 – 6:00' },
      { day: 'Saturday', time: '9:00 – 2:00' },
      { day: 'Sunday', time: 'Closed' },
    ],
  }),
  bookingCta({
    title: 'Rather book than call?',
    sub: 'See live openings and reserve your pet’s time online — no phone tag, no hold music.',
    surface: 'muted',
    cta: { label: 'Book an appointment', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-vet-neighborhood',
  name: 'Veterinary (Neighborhood)',
  summary:
    'A warm, friendly neighborhood vet-clinic site — a caring teal palette, a coral accent and a clean warm-white ground. Installs a working booking flow: appointment types (wellness, vaccines, sick visits, dental, senior care), two vets and a tech you book by name, and exam rooms as resources so each visit reserves both a doctor and a room. Ships as "Cedar Paws Veterinary", a full-service clinic for dogs and cats.',
  tagline: 'A warm, friendly template for neighborhood vet clinics — book online from day one.',
  industry: 'Veterinary',
  sortWeight: 62,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'Cedar Paws Veterinary', tagline: 'Your pet’s second family.' },
  theme: cedarpaws,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Cedar Paws Veterinary — a friendly neighborhood vet clinic',
      description:
        'Cedar Paws is a full-service neighborhood vet for dogs and cats — wellness, vaccines, sick visits, dental and senior care. Book your appointment online.',
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
