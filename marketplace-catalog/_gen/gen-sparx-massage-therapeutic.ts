// sparx-massage-therapeutic — "Meridian Bodywork", a CLINICAL therapeutic massage practice.
//
// The results-driven, medical-adjacent bodywork studio — deep tissue, sports and recovery,
// prenatal, cupping, trigger-point and medical/rehab work. Deliberately the OPPOSITE of a
// relaxation day spa: a cool slate-and-teal palette, a clean confident sans (Outfit over
// Inter, never a serif), small radii, and copy that leads with the OUTCOME — pain relief,
// mobility, recovery — not candles and calm. Licensed therapists, an assessment first, a
// real treatment plan, superbills for HSA/insurance. Same booking spine as the salon and
// medspa templates, a different business: therapists AND treatment rooms are both bookable
// resources, so every hands-on session reserves a person and a room at once.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @wizeworks/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-massage-therapeutic.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-massage-therapeutic/**" \
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
  hero: 'massage-therapeutic-hero',
  room: 'massage-therapeutic-room',
  method: 'massage-therapeutic-method',
  dana: 'massage-therapeutic-dana',
  marisol: 'massage-therapeutic-marisol',
  theo: 'massage-therapeutic-theo',
} as const;

const PHOTO: Record<string, string> = {
  "meridian-hero": "https://images.unsplash.com/photo-1519824145371-296894a0daa9?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c3BvcnRzJTIwbWFzc2FnZSUyMHRoZXJhcHl8ZW58MHwwfHx8MTc4NjM4NzM5N3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "meridian-method": "https://images.unsplash.com/photo-1649751361457-01d3a696c7e6?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGh5c2ljYWwlMjB0aGVyYXB5JTIwc3BvcnRzfGVufDB8MHx8fDE3ODYzODc0MDJ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "meridian-dana": "https://images.unsplash.com/photo-1506863530036-1efeddceb993?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cHJvZmVzc2lvbmFsJTIwd29tYW4lMjBwb3J0cmFpdHxlbnwwfDB8fHwxNzg2Mzg3NDA1fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "meridian-marisol": "https://images.unsplash.com/photo-1484863137850-59afcfe05386?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cHJvZmVzc2lvbmFsJTIwd29tYW4lMjBwb3J0cmFpdCUyMHNtaWxpbmd8ZW58MHwwfHx8MTc4NjM4NzQwOHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "meridian-theo": "https://images.unsplash.com/photo-1676989880361-091e12efc056?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cHJvZmVzc2lvbmFsJTIwbWFuJTIwcG9ydHJhaXR8ZW58MHwwfHx8MTc4NjM4NzQxMHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "meridian-room": "https://images.unsplash.com/photo-1630835425197-50feeba99ecd?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bWFzc2FnZSUyMHRhYmxlJTIwc3BhJTIwcm9vbXxlbnwwfDB8fHwxNzg2Mzg3NTU3fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
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
    url: src('meridian-hero'),
    alt: 'A therapist working along a client’s back with focused, deliberate pressure',
  },
  {
    id: IMG.room,
    url: src('meridian-room'),
    alt: 'A calm, clinical treatment room with a dressed table and warm light',
  },
  {
    id: IMG.method,
    url: src('meridian-method'),
    alt: 'A therapist assessing a client’s shoulder range of motion before treatment',
  },
  {
    id: IMG.dana,
    url: src('meridian-dana'),
    alt: 'Dana Okafor, licensed massage therapist',
  },
  {
    id: IMG.marisol,
    url: src('meridian-marisol'),
    alt: 'Marisol Reyes, licensed massage therapist',
  },
  {
    id: IMG.theo,
    url: src('meridian-theo'),
    alt: 'Theo Lindqvist, licensed massage therapist',
  },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-massage-therapeutic: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "meridian": clinical-calm, cool slate/teal ground, muted-steel secondary,
//    restrained warm accent, a confident sans display (Outfit) over Inter body ──────
const meridian = defineTheme({
  name: 'meridian',
  type: { body: face('Inter', 'sans-serif'), head: face('Outfit', 'sans-serif') },
  shape: { selector: '0.25rem', field: '0.25rem', box: '0.375rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(98% 0.005 220)', // cool white
      'oklch(95% 0.008 225)', // pale steel
      'oklch(89% 0.013 228)', // hairline
      'oklch(27% 0.028 245)', // deep slate ink
    ],
    roles: {
      primary: 'oklch(50% 0.075 210)', // slate-teal
      secondary: 'oklch(46% 0.022 245)', // muted steel
      accent: 'oklch(68% 0.085 55)', // restrained warm clay
      neutral: 'oklch(30% 0.02 245)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(22% 0.02 245)',
      'oklch(18% 0.018 245)',
      'oklch(14% 0.015 245)',
      'oklch(94% 0.006 220)',
    ],
    roles: {
      primary: 'oklch(68% 0.09 205)',
      secondary: 'oklch(72% 0.02 240)',
      accent: 'oklch(74% 0.08 58)',
      neutral: 'oklch(82% 0.015 240)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the booking spine (policies, therapists + rooms + hours, the menu) ────
const hours = (days: number[], startMinute: number, endMinute: number) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

const SCHEDULING = {
  policies: [
    {
      handle: 'meridian-standard',
      name: 'Standard booking',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [1440, 120],
      policyText:
        'Please give us at least 24 hours’ notice to change or cancel. We text a reminder the day before and two hours ahead so the time is never wasted.',
    },
    {
      handle: 'meridian-hold',
      name: 'Card-on-file hold',
      depositType: 'card_hold',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [2880, 1440, 120],
      policyText:
        'Longer sessions and rehab intakes hold a card on file — nothing is charged unless you no-show or cancel inside 24 hours. It keeps a two-hour room block open for the person who needs it.',
    },
  ],
  resources: [
    {
      handle: 'dana',
      name: 'Dana Okafor, LMT',
      kind: 'staff',
      skillTags: ['deep-tissue', 'sports', 'trigger-point'],
      windows: hours([1, 2, 3, 4, 5], 540, 1140), // Mon–Fri 9–7
    },
    {
      handle: 'marisol',
      name: 'Marisol Reyes, LMT',
      kind: 'staff',
      skillTags: ['prenatal', 'swedish', 'cupping'],
      windows: hours([2, 3, 4, 5, 6], 600, 1080), // Tue–Sat 10–6
    },
    {
      handle: 'theo',
      name: 'Theo Lindqvist, LMT',
      kind: 'staff',
      skillTags: ['deep-tissue', 'medical', 'sports'],
      windows: hours([1, 3, 4, 5, 6], 480, 1020), // Mon, Wed–Sat 8–5
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
      handle: 'deep-tissue-60',
      name: 'Deep tissue — 60 min',
      description:
        'Firm, focused work into the layers that hold tension — for the neck, back and shoulders that never quite let go.',
      durationMinutes: 60,
      priceCents: 11000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'therapist', kind: 'staff', skillTags: ['deep-tissue'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['room'], count: 1 },
      ],
      policyHandle: 'meridian-standard',
    },
    {
      handle: 'deep-tissue-90',
      name: 'Deep tissue — 90 min',
      description:
        'The full session — time to work more than one area properly and actually change how it moves, not just soothe it.',
      durationMinutes: 90,
      priceCents: 15500,
      bufferAfterMin: 10,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'therapist', kind: 'staff', skillTags: ['deep-tissue'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['room'], count: 1 },
      ],
      policyHandle: 'meridian-standard',
    },
    {
      handle: 'sports-recovery-90',
      name: 'Sports & recovery — 90 min',
      description:
        'For training loads and stubborn injuries: assisted stretching, targeted release and a plan to get you back to the thing you do.',
      durationMinutes: 90,
      priceCents: 16500,
      bufferAfterMin: 10,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'therapist', kind: 'staff', skillTags: ['sports'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['room'], count: 1 },
      ],
      policyHandle: 'meridian-hold',
    },
    {
      handle: 'trigger-point-60',
      name: 'Trigger-point therapy — 60 min',
      description:
        'Pinpoint work on the knots that refer pain elsewhere — the headache that starts in your shoulder, the ache that never sits still.',
      durationMinutes: 60,
      priceCents: 12000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'therapist', kind: 'staff', skillTags: ['trigger-point'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['room'], count: 1 },
      ],
      policyHandle: 'meridian-standard',
    },
    {
      handle: 'prenatal-60',
      name: 'Prenatal massage — 60 min',
      description:
        'Safe, side-lying work for the lower back, hips and legs that carry a pregnancy — from a therapist trained for it.',
      durationMinutes: 60,
      priceCents: 11000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'therapist', kind: 'staff', skillTags: ['prenatal'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['room'], count: 1 },
      ],
      policyHandle: 'meridian-standard',
    },
    {
      handle: 'cupping-therapy-60',
      name: 'Cupping & myofascial — 60 min',
      description:
        'Decompression cupping paired with hands-on myofascial release to free up tight fascia and restore glide to stuck tissue.',
      durationMinutes: 60,
      priceCents: 12500,
      bufferAfterMin: 10,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'therapist', kind: 'staff', skillTags: ['cupping'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['room'], count: 1 },
      ],
      policyHandle: 'meridian-standard',
    },
    {
      handle: 'medical-rehab-120',
      name: 'Medical & rehab intake — 120 min',
      description:
        'A full assessment and first treatment for post-injury or post-surgical recovery — we review your history, agree a plan, and provide a superbill for your insurer or HSA. Booked with a short approval so we can prepare.',
      durationMinutes: 120,
      priceCents: 21000,
      bufferAfterMin: 15,
      requiresApproval: true,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'therapist', kind: 'staff', skillTags: ['medical'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['room'], count: 1 },
      ],
      policyHandle: 'meridian-hold',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  photoHero({
    image: url(IMG.hero),
    alt: 'A therapist working along a client’s back with focused, deliberate pressure',
    title: 'Fix the thing that hurts',
    sub: 'Meridian Bodywork is a therapeutic massage practice — licensed therapists, a real assessment first, and treatment that targets the pain instead of talking around it.',
    primary: { label: 'Book a session', href: '/book' },
    secondary: { label: 'See treatments', href: '/book' },
    overlay: 'darker',
  }),
  featureRow({
    items: [
      {
        title: 'Licensed therapists, every session',
        body: 'You’re in the hands of a state-licensed massage therapist (LMT) trained in clinical work — not a rotating list of names. You book the person, and you keep seeing them.',
      },
      {
        title: 'We assess before we treat',
        body: 'Every first visit starts with real questions and a movement check. We find where the pain actually comes from, then build the session around it.',
      },
      {
        title: 'Superbills for HSA & insurance',
        body: 'Ask and we’ll provide an itemized superbill you can submit to your insurer or pay for with an HSA/FSA card. Recovery is a health expense, and we treat it like one.',
      },
    ],
  }),
  serviceMenu({
    heading: 'Treatment by concern',
    intro: 'Booked by what you need to fix, not by scented add-ons. Full prices and live availability are on the booking page.',
    surface: 'muted',
    columns: 2,
    items: [
      {
        name: 'Deep tissue',
        priceCents: 11000,
        durationMin: 60,
        desc: 'Firm, focused work into the layers that hold chronic tension.',
      },
      {
        name: 'Sports & recovery',
        priceCents: 16500,
        durationMin: 90,
        desc: 'Assisted stretching and targeted release for training and injury.',
      },
      {
        name: 'Trigger-point therapy',
        priceCents: 12000,
        durationMin: 60,
        desc: 'Pinpoint work on the knots that refer pain elsewhere.',
      },
      {
        name: 'Prenatal massage',
        priceCents: 11000,
        durationMin: 60,
        desc: 'Safe, side-lying work for the back, hips and legs of pregnancy.',
      },
      {
        name: 'Cupping & myofascial',
        priceCents: 12500,
        durationMin: 60,
        desc: 'Decompression cupping paired with hands-on fascial release.',
      },
      {
        name: 'Medical & rehab intake',
        priceCents: 21000,
        durationMin: 120,
        desc: 'Full assessment and first treatment for post-injury recovery.',
      },
    ],
    cta: { label: 'See everything & book', href: '/book' },
  }),
  splitFeature({
    image: url(IMG.method),
    alt: 'A therapist assessing a client’s shoulder range of motion before treatment',
    heading: 'Assessment first, guesswork never',
    body: [
      'Most massage starts the moment you lie down. Ours starts with a conversation — what hurts, when it started, what makes it worse, and how it’s stopping you. Then we check how you actually move.',
      'That assessment becomes a plan: which tissue to work, how hard, how often, and what to do between visits. You leave knowing what we found and what comes next — not just relaxed for an afternoon.',
    ],
    cta: { label: 'Start with an assessment', href: '/book' },
  }),
  teamRow({
    heading: 'Your therapists',
    intro: 'Book by name and modality — you’ll see the same licensed therapist each visit.',
    members: [
      {
        name: 'Dana Okafor, LMT',
        role: 'Deep tissue · Sports · Trigger-point',
        image: url(IMG.dana),
        alt: 'Dana Okafor, licensed massage therapist',
        bio: 'Ten years of clinical deep-tissue and sports work. Dana leads the practice and the runners, lifters and desk-bound necks that come with it.',
      },
      {
        name: 'Marisol Reyes, LMT',
        role: 'Prenatal · Swedish · Cupping',
        image: url(IMG.marisol),
        alt: 'Marisol Reyes, licensed massage therapist',
        bio: 'Certified in prenatal and perinatal bodywork, with a gentle, methodical hand for pregnancy, recovery and fascial release.',
      },
      {
        name: 'Theo Lindqvist, LMT',
        role: 'Deep tissue · Medical · Sports',
        image: url(IMG.theo),
        alt: 'Theo Lindqvist, licensed massage therapist',
        bio: 'Works closely with local physios on post-injury and post-surgical rehab — the therapist you want when there’s a diagnosis attached.',
      },
    ],
  }),
  testimonial({
    quote:
      'I’d had lower-back pain for two years and had stopped running. Theo actually assessed it, gave me a plan, and six weeks later I ran a 10K. This isn’t a spa — it’s treatment that worked.',
    attribution: 'Marcus, client since 2024',
  }),
  bookingCta({
    title: 'Stop working around the pain',
    sub: 'Pick a treatment, choose your therapist and see live times. Book in about a minute.',
    cta: { label: 'Book a session', href: '/book' },
  }),
];

const BOOK_INTRO = [
  photoHero({
    image: url(IMG.room),
    alt: 'A calm, clinical treatment room with a dressed table and warm light',
    title: 'Book your session',
    sub: 'Choose a treatment to see prices and live availability, then pick your therapist and time. First visit? Start with an assessment.',
    primary: { label: 'See treatments below', href: '/book' },
    overlay: 'darker',
    align: 'start',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.hero),
    alt: 'A therapist working along a client’s back with focused, deliberate pressure',
    heading: 'About Meridian Bodywork',
    body: [
      'We opened Meridian Bodywork because good therapeutic massage is hard to find — the kind that treats a problem instead of selling an hour of quiet. Every therapist here is state-licensed and trained in clinical work.',
      'We keep the day unhurried, the rooms private and the plan honest. If we’re not the right care for what you’re dealing with, we’ll tell you and point you to who is. The goal is always the same: less pain, more movement, fewer visits over time.',
    ],
    cta: { label: 'Book a session', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'How we work',
    items: [
      {
        title: 'Assessment, then treatment',
        body: 'Every first visit includes a history and a movement check. We treat the cause we find, not just the spot that aches.',
      },
      {
        title: 'A plan you can keep',
        body: 'You leave with what we worked on, what to expect, and a short list of things to do between sessions so the progress holds.',
      },
      {
        title: 'Paperwork that helps',
        body: 'Superbills on request for insurance and HSA/FSA, clear notes, and coordination with your physio or physician when it matters.',
      },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Visit the practice',
    address: ['Meridian Bodywork', '340 Cascade Avenue', 'Suite 3 · Portland, OR 97214'],
    mapLocation: '340 Cascade Avenue, Portland, OR 97214',
    hours: [
      { day: 'Monday – Friday', time: '8:00 – 7:00' },
      { day: 'Saturday', time: '9:00 – 5:00' },
      { day: 'Sunday', time: 'Closed' },
    ],
  }),
  bookingCta({
    title: 'Rather book than call?',
    sub: 'See live availability and reserve your therapist and room online — no phone tag.',
    surface: 'muted',
    cta: { label: 'Book a session', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-massage-therapeutic',
  name: 'Massage (Therapeutic)',
  summary:
    'A clinical therapeutic-massage site — a cool slate-and-teal palette, a muted-steel secondary and a confident sans display, leading with the outcome, not luxury. Installs a working booking flow: a menu by concern (deep tissue, sports recovery, prenatal, cupping, trigger-point, medical/rehab), three licensed therapists and two treatment rooms as bookable resources, and standard plus card-hold policies. Ships as "Meridian Bodywork".',
  tagline: 'A results-driven template for therapeutic massage — book online from day one.',
  industry: 'Massage therapy',
  sortWeight: 84,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'Meridian Bodywork', tagline: 'Therapeutic massage that fixes the thing that hurts.' },
  theme: meridian,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Meridian Bodywork — therapeutic massage',
      description:
        'Meridian Bodywork is a clinical massage practice for pain relief and recovery — deep tissue, sports, prenatal, cupping and rehab. Licensed therapists, assessment first. Book online.',
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
