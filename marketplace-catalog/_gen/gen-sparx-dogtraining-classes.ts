// sparx-dogtraining-classes — "Good Dog Academy", a WARM, PLAYFUL positive-reinforcement
// dog-training SCHOOL.
//
// The friendly group-classes studio of the pet-services lane: a cheerful teal-green primary
// over a warm off-white ground, a sunny coral accent, and rounded, approachable type (a
// rounded friendly sans display over a clean sans). Built around GROUP CLASSES WITH CAPACITY
// — puppy kindergarten, basic & intermediate obedience and a tricks class — plus 1:1 private
// sessions and a free evaluation. It is deliberately the OPPOSITE of its sibling private /
// board-and-train behavior template (bold, results-driven): this one is force-free, playful,
// "come learn together," with owners and dogs enrolling in a class as a small joyful group.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-dogtraining-classes.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-dogtraining-classes/**" \
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
  hero: 'dogtraining-hero',
  method: 'dogtraining-method',
  bailey: 'dogtraining-bailey',
  marcus: 'dogtraining-marcus',
  priya: 'dogtraining-priya',
  dog1: 'dogtraining-dog1',
  dog2: 'dogtraining-dog2',
  dog3: 'dogtraining-dog3',
} as const;

const PHOTO: Record<string, string> = {
  "gooddog-hero": "https://images.unsplash.com/photo-1556866261-8763a7662333?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZG9nJTIwdHJhaW5pbmclMjBjbGFzc3xlbnwwfDB8fHwxNzg2MzkxNDg5fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "gooddog-method": "https://images.unsplash.com/photo-1620289052446-202137ffa876?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZG9nJTIwb2JlZGllbmNlJTIwdHJhaW5pbmd8ZW58MHwwfHx8MTc4NjM5MTQ5Mnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "gooddog-bailey": "https://images.unsplash.com/photo-1551779891-b83901e1f8b3?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZG9nJTIwdHJhaW5lciUyMHBvcnRyYWl0JTIwd29tYW58ZW58MHwwfHx8MTc4NjM5MTQ5NXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "gooddog-marcus": "https://images.unsplash.com/photo-1535812859-6bfd2f132e78?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZG9nJTIwdHJhaW5lciUyMHBvcnRyYWl0JTIwbWFufGVufDB8MHx8fDE3ODYzOTE0OTh8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "gooddog-priya": "https://images.unsplash.com/photo-1579119134757-5c38803f34fc?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjB3aXRoJTIwZG9nJTIwcG9ydHJhaXR8ZW58MHwwfHx8MTc4NjM4NzQ4N3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "gooddog-dog1": "https://images.unsplash.com/photo-1543466835-00a7907e9de1?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8aGFwcHklMjBkb2clMjBzaXR0aW5nfGVufDB8MHx8fDE3ODYzOTE1MDN8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "gooddog-dog2": "https://images.unsplash.com/photo-1507146426996-ef05306b995a?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cHVwcHklMjB0cmFpbmluZ3xlbnwwfDB8fHwxNzg2MzkxNTA2fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "gooddog-dog3": "https://images.unsplash.com/photo-1586875331842-5409a287612d?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZG9nJTIwcGxheWluZyUyMHBhcmt8ZW58MHwwfHx8MTc4NjM5MTUwOXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (seed: string): string =>
  PHOTO[seed] ?? `https://picsum.photos/seed/${seed}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}
const ASSETS: Asset[] = [
  { id: IMG.hero, url: src('gooddog-hero'), alt: 'A happy group class of dogs and owners training together on a sunny field' },
  { id: IMG.method, url: src('gooddog-method'), alt: 'A trainer rewarding a delighted dog with a treat during a lesson' },
  { id: IMG.bailey, url: src('gooddog-bailey'), alt: 'Bailey Nguyen, head trainer, kneeling with a puppy' },
  { id: IMG.marcus, url: src('gooddog-marcus'), alt: 'Marcus Reed, obedience and tricks trainer, with a golden retriever' },
  { id: IMG.priya, url: src('gooddog-priya'), alt: 'Priya Shah, puppy and private-session trainer, laughing with a small dog' },
  { id: IMG.dog1, url: src('gooddog-dog1'), alt: 'A young puppy sitting proudly on cue' },
  { id: IMG.dog2, url: src('gooddog-dog2'), alt: 'A dog offering a paw to its owner' },
  { id: IMG.dog3, url: src('gooddog-dog3'), alt: 'A pair of dogs playing together after class' },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-dogtraining-classes: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "gooddog": warm off-white ground, cheerful teal-green primary, sunny coral ─
// accent, a DARK readable secondary, and rounded friendly type. Playful, encouraging.
const gooddog = defineTheme({
  name: 'gooddog',
  type: { body: face('Inter', 'sans-serif'), head: face('Nunito', 'sans-serif') },
  shape: { selector: '1rem', field: '0.75rem', box: '1.25rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(97% 0.012 95)', // warm off-white
      'oklch(94% 0.018 100)', // sunny cream
      'oklch(88% 0.022 120)', // soft green hairline
      'oklch(27% 0.03 190)', // dark teal-charcoal ink
    ],
    roles: {
      primary: 'oklch(64% 0.115 172)', // cheerful teal-green
      secondary: 'oklch(36% 0.04 195)', // deep slate teal (dark, readable on light)
      accent: 'oklch(72% 0.14 42)', // sunny coral
      neutral: 'oklch(31% 0.025 195)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(24% 0.03 195)',
      'oklch(20% 0.024 195)',
      'oklch(16% 0.02 195)',
      'oklch(95% 0.012 100)',
    ],
    roles: {
      primary: 'oklch(74% 0.115 172)',
      secondary: 'oklch(80% 0.03 170)',
      accent: 'oklch(76% 0.13 44)',
      neutral: 'oklch(84% 0.02 170)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the booking spine (class + deposit policies, trainers + the training room, ─
// the class & session menu with capacity).
const hours = (days: number[], startMinute: number, endMinute: number) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

const SCHEDULING = {
  policies: [
    {
      handle: 'class-standard',
      name: 'Class & session booking',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [1440, 120],
      policyText:
        'Give us at least 24 hours’ notice to change or cancel and your spot frees up for the next pup — classes are small and fill fast. We send a friendly reminder the day before and two hours ahead.',
    },
    {
      handle: 'enrollment-deposit',
      name: 'Class enrollment deposit',
      depositType: 'deposit',
      depositAmountCents: 2000,
      cancellationWindowHours: 48,
      reminderOffsetsMin: [2880, 1440, 120],
      policyText:
        'Group classes run as a series, so a $20 deposit holds your place in the group and comes right off your total. Let us know 48 hours ahead to move to another start date and it carries over.',
    },
  ],
  resources: [
    {
      handle: 'bailey',
      name: 'Bailey Nguyen',
      kind: 'staff',
      skillTags: ['puppy', 'obedience', 'group'],
      windows: hours([2, 3, 4, 6], 540, 1080), // Tue, Wed, Thu, Sat 9–6
    },
    {
      handle: 'marcus',
      name: 'Marcus Reed',
      kind: 'staff',
      skillTags: ['obedience', 'tricks', 'group'],
      windows: hours([2, 4, 5, 6], 600, 1140), // Tue, Thu, Fri, Sat 10–7
    },
    {
      handle: 'priya',
      name: 'Priya Shah',
      kind: 'staff',
      skillTags: ['puppy', 'private', 'group'],
      windows: hours([1, 3, 5, 0], 540, 1020), // Mon, Wed, Fri, Sun 9–5
    },
    {
      handle: 'training-room',
      name: 'The Playroom (training hall)',
      kind: 'space',
      skillTags: ['training-room'],
      windows: hours([1, 2, 3, 4, 5, 6, 0], 480, 1200), // every day 8am–8pm
    },
  ],
  services: [
    {
      handle: 'free-evaluation',
      name: 'Free meet & evaluation',
      description:
        'A no-cost, no-pressure first visit — we meet you and your dog, talk through your goals, and point you to the right class. New here? Start exactly here.',
      bookingType: 'appointment',
      durationMinutes: 45,
      priceCents: 0,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'trainer', kind: 'staff', skillTags: ['group'], count: 1 }],
      policyHandle: 'class-standard',
    },
    {
      handle: 'puppy-kindergarten',
      name: 'Puppy kindergarten',
      description:
        'The joyful first-steps class for pups 8–20 weeks — gentle socialization, name games, sit and settle, and confidence with the big world. All the good habits, started early.',
      bookingType: 'class',
      durationMinutes: 60,
      priceCents: 12000,
      capacity: 8,
      assignmentStrategy: 'collective',
      resourceRequirements: [
        { role: 'trainer', kind: 'staff', skillTags: ['group'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['training-room'], count: 1 },
      ],
      policyHandle: 'enrollment-deposit',
    },
    {
      handle: 'basic-obedience-class',
      name: 'Basic obedience',
      description:
        'The everyday-manners class for dogs of any age — sit, down, stay, come when called, and polite leash walking, all taught force-free and made to stick at home.',
      bookingType: 'class',
      durationMinutes: 60,
      priceCents: 14000,
      capacity: 10,
      assignmentStrategy: 'collective',
      resourceRequirements: [
        { role: 'trainer', kind: 'staff', skillTags: ['group'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['training-room'], count: 1 },
      ],
      policyHandle: 'enrollment-deposit',
    },
    {
      handle: 'intermediate-class',
      name: 'Intermediate skills',
      description:
        'The next step once the basics are solid — longer stays, reliable recall with distractions, loose-leash walking in the real world, and a calm, focused dog wherever you go.',
      bookingType: 'class',
      durationMinutes: 60,
      priceCents: 14000,
      capacity: 8,
      assignmentStrategy: 'collective',
      resourceRequirements: [
        { role: 'trainer', kind: 'staff', skillTags: ['group'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['training-room'], count: 1 },
      ],
      policyHandle: 'enrollment-deposit',
    },
    {
      handle: 'tricks-class',
      name: 'Tricks & games',
      description:
        'The pure-fun class — spin, shake, roll over, weave and more. Great for bonding, brilliant for burning mental energy, and the friendliest way to fall in love with training.',
      bookingType: 'class',
      durationMinutes: 45,
      priceCents: 10000,
      capacity: 6,
      assignmentStrategy: 'collective',
      resourceRequirements: [
        { role: 'trainer', kind: 'staff', skillTags: ['group'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['training-room'], count: 1 },
      ],
      policyHandle: 'enrollment-deposit',
    },
    {
      handle: 'private-session',
      name: 'Private session',
      description:
        'One-on-one time for a specific goal — a shy pup, a tricky behavior, or just a head start before a class. We build a friendly, force-free plan around your dog.',
      bookingType: 'appointment',
      durationMinutes: 60,
      priceCents: 9000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'trainer', kind: 'staff', skillTags: ['private'], count: 1 }],
      policyHandle: 'class-standard',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  photoHero({
    image: url(IMG.hero),
    alt: 'A happy group class of dogs and owners training together on a sunny field',
    title: 'Every good dog starts here',
    sub: 'Friendly, force-free classes for puppies and grown dogs alike — small groups, big tails, and real-life manners that stick. Come learn together.',
    primary: { label: 'Enroll in a class', href: '/book' },
    secondary: { label: 'See the classes', href: '/book' },
    overlay: 'dark',
  }),
  featureRow({
    items: [
      {
        title: 'Certified, kind trainers',
        body: 'Every class is led by a certified, positive-reinforcement trainer — no fear, no force, just treats, praise and patience that actually works.',
      },
      {
        title: 'Small classes, real attention',
        body: 'We keep every group small so your trainer can see you, help you, and cheer you on. Fewer dogs, more progress, a room that stays calm.',
      },
      {
        title: 'All ages & breeds welcome',
        body: 'Eight-week puppy or eight-year-old rescue, tiny or enormous, shy or bouncy — every dog is welcome, and every one goes at its own happy pace.',
      },
      {
        title: 'Skills for real life',
        body: 'We teach the things you actually need — coming when called, walking politely, settling at home — so training works on a Tuesday, not just in class.',
      },
    ],
  }),
  serviceMenu({
    heading: 'Classes & sessions',
    intro: 'Find the right fit for your dog. Full prices, start dates and live availability are on the enrollment page.',
    surface: 'muted',
    columns: 2,
    items: [
      { name: 'Free meet & evaluation', priceCents: 0, durationMin: 45, desc: 'A no-pressure first visit — start here.' },
      { name: 'Puppy kindergarten', priceCents: 12000, durationMin: 60, desc: 'Socialization and first good habits.' },
      { name: 'Basic obedience', priceCents: 14000, durationMin: 60, desc: 'Sit, stay, come and polite walking.' },
      { name: 'Intermediate skills', priceCents: 14000, durationMin: 60, desc: 'Reliable recall and real-world focus.' },
      { name: 'Tricks & games', priceCents: 10000, durationMin: 45, desc: 'Spin, shake, weave — pure fun.' },
      { name: 'Private session', priceCents: 9000, durationMin: 60, desc: 'One-on-one help for a specific goal.' },
    ],
    cta: { label: 'See everything & enroll', href: '/book' },
  }),
  galleryStrip({
    heading: 'Good dogs at work',
    surface: 'base',
    columns: 3,
    images: [
      { src: url(IMG.dog1), alt: 'A young puppy sitting proudly on cue' },
      { src: url(IMG.dog2), alt: 'A dog offering a paw to its owner' },
      { src: url(IMG.dog3), alt: 'A pair of dogs playing together after class' },
    ],
  }),
  splitFeature({
    image: url(IMG.method),
    alt: 'A trainer rewarding a delighted dog with a treat during a lesson',
    heading: 'Force-free, because it works',
    body: [
      'We train the way dogs actually learn — by rewarding the things we love and setting them up to get it right. No prong collars, no shouting, no fear. Just clear communication and a whole lot of encouragement.',
      'It’s kinder, it’s more fun, and it builds a dog who wants to work with you — not one who’s just avoiding a correction. That bond is the whole point, and it’s the part that lasts.',
    ],
    cta: { label: 'Book a free evaluation', href: '/book' },
  }),
  teamRow({
    heading: 'Meet your trainers',
    intro: 'Certified, endlessly patient, and genuinely happy to be here. You’ll get to know them by name.',
    members: [
      { name: 'Bailey Nguyen', role: 'Head trainer', image: url(IMG.bailey), alt: 'Bailey Nguyen, head trainer, kneeling with a puppy', bio: 'Puppy foundations and everyday obedience. Bailey runs the school and never met a dog she couldn’t win over.' },
      { name: 'Marcus Reed', role: 'Obedience & tricks', image: url(IMG.marcus), alt: 'Marcus Reed, obedience and tricks trainer, with a golden retriever', bio: 'Real-world manners and the crowd-favorite tricks class — proof that serious skills can be seriously fun.' },
      { name: 'Priya Shah', role: 'Puppy & private sessions', image: url(IMG.priya), alt: 'Priya Shah, puppy and private-session trainer, laughing with a small dog', bio: 'Gentle with shy dogs and brand-new owners alike. Priya leads puppy classes and one-on-one sessions.' },
    ],
  }),
  testimonial({
    quote: 'We came in with a whirlwind of a rescue and left with a dog who actually looks to us. Nobody made us feel like we were failing — they just cheered every tiny win until they added up.',
    attribution: 'The Alvarez family, Basic obedience grads',
  }),
  bookingCta({
    title: 'Ready to get started?',
    sub: 'Pick a class or book a free meet & evaluation — choose a time, and you’re set. It takes about a minute.',
    cta: { label: 'Enroll in a class', href: '/book' },
  }),
];

const BOOK_INTRO = [
  photoHero({
    image: url(IMG.method),
    alt: 'A trainer rewarding a delighted dog with a treat during a lesson',
    title: 'Enroll in a class',
    sub: 'Choose a class or session to see the price, how long it runs and live availability — then pick your trainer and start date.',
    primary: { label: 'See classes below', href: '/book' },
    overlay: 'darker',
    align: 'start',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.hero),
    alt: 'A happy group class of dogs and owners training together on a sunny field',
    heading: 'About Good Dog Academy',
    body: [
      'We started Good Dog Academy because training should feel good — for the dog and for you. Too many classes lean on fear and force; we wanted a place built entirely on kindness, treats and encouragement.',
      'So this is a school where every dog is welcome, every owner is a beginner at something, and every small win gets a cheer. Come as you are, bring your dog exactly as they are, and let’s build something great together.',
    ],
    cta: { label: 'Book a free evaluation', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'How the school works',
    items: [
      { title: 'Start with a free evaluation', body: 'Not sure where to begin? Book a free meet & evaluation. We’ll get to know your dog, talk through your goals, and point you to the class that fits.' },
      { title: 'Learn together in small groups', body: 'Classes run as a friendly series in our training hall — small, capped, and full of encouragement. You and your dog learn side by side with others doing the same.' },
      { title: 'Take it home with you', body: 'Every class ends with exactly how to practice this week. The goal is a dog who’s wonderful at home and out in the world, not just in the room.' },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Come visit the school',
    address: ['Good Dog Academy', '212 Maplewood Avenue', 'Fort Collins, CO 80521'],
    mapLocation: '212 Maplewood Avenue, Fort Collins, CO 80521',
    hours: [
      { day: 'Monday', time: '9:00 – 5:00' },
      { day: 'Tuesday – Thursday', time: '9:00 – 7:00' },
      { day: 'Friday – Saturday', time: '9:00 – 6:00' },
      { day: 'Sunday', time: '10:00 – 4:00' },
    ],
  }),
  bookingCta({
    title: 'Rather book than call?',
    sub: 'See live class times and reserve your spot online — no phone tag, no pressure.',
    surface: 'muted',
    cta: { label: 'Enroll in a class', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-dogtraining-classes',
  name: 'Dog Training (Classes)',
  summary:
    'A warm, playful dog-training-school site — a cheerful teal-green palette, sunny coral accent and rounded, friendly type. Installs a live class schedule with capacity: puppy kindergarten, basic and intermediate obedience and a tricks class, each a group class you enroll in online, plus 1:1 private sessions and a free evaluation. Three positive-reinforcement trainers and a training hall book as resources. Ships as "Good Dog Academy".',
  tagline: 'A friendly, force-free template for dog-training schools — enroll in classes online from day one.',
  industry: 'Dog training',
  sortWeight: 52,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'Good Dog Academy', tagline: 'Every good dog starts here.' },
  theme: gooddog,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Good Dog Academy — friendly, force-free dog training',
      description:
        'Good Dog Academy runs warm, positive-reinforcement classes for puppies and grown dogs — puppy kindergarten, obedience, tricks, private sessions and a free evaluation. Small classes, certified trainers. Enroll online.',
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
