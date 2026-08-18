// sparx-music-studio — "Amp Room", a modern CONTEMPORARY music-lessons studio.
//
// The cool, creative, current studio: guitar, vocals, bass, music production/beat-making,
// songwriting and performance coaching for teens and adults. A dark charcoal-violet ground
// held dark in BOTH modes, an electric-violet primary and a lime accent, a modern sharp
// sans display over a clean humanist sans, tight radii. Deliberately the OPPOSITE of the
// warm all-ages community-school sibling (serif, cream, cosy) — same booking spine, a
// radically different business: contemporary, production-forward, book a trial and plug in.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @wizeworks/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-music-studio.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-music-studio/**" \
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
  teamRow,
  testimonial,
  typeHero,
  type ServiceSiteSpec,
} from './service-sites/harness';

// ── Imagery (swap-ready; each id also names an entry in ASSETS) ────────────────────
const IMG = {
  room: 'amproom-live-room',
  suite: 'amproom-production-suite',
  jules: 'amproom-jules',
  nova: 'amproom-nova',
  dez: 'amproom-dez',
} as const;

const PHOTO: Record<string, string> = {
  "amproom-live-room": "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bXVzaWMlMjBzdHVkaW8lMjBndWl0YXJ8ZW58MHwwfHx8MTc4NjM5MTU0MHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "amproom-production-suite": "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bXVzaWMlMjBwcm9kdWN0aW9uJTIwc3R1ZGlvfGVufDB8MHx8fDE3ODYzOTE1NDJ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "amproom-jules": "https://images.unsplash.com/photo-1595971294624-80bcf0d7eb24?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bXVzaWNpYW4lMjBwb3J0cmFpdCUyMGd1aXRhcnxlbnwwfDB8fHwxNzg2MzkxNTQ1fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "amproom-nova": "https://images.unsplash.com/photo-1517230878791-4d28214057c2?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjBzaW5nZXIlMjBwb3J0cmFpdHxlbnwwfDB8fHwxNzg2MzkxNTQ4fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "amproom-dez": "https://images.unsplash.com/photo-1650765814769-593f0798d6e1?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bXVzaWMlMjBwcm9kdWNlciUyMHBvcnRyYWl0fGVufDB8MHx8fDE3ODYzOTE1NTF8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (seed: string): string =>
  PHOTO[seed] ?? `https://picsum.photos/seed/${seed}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}
const ASSETS: Asset[] = [
  { id: IMG.room, url: src('amproom-live-room'), alt: 'A live room with amps, a drum kit and warm stage lighting' },
  { id: IMG.suite, url: src('amproom-production-suite'), alt: 'A production suite with a mixing desk, monitors and a mic booth' },
  { id: IMG.jules, url: src('amproom-jules'), alt: 'Jules Kade, guitar, bass & songwriting instructor' },
  { id: IMG.nova, url: src('amproom-nova'), alt: 'Nova Reyes, vocals, songwriting & performance coach' },
  { id: IMG.dez, url: src('amproom-dez'), alt: 'Dez Okonkwo, music production & beat-making instructor' },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-music-studio: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "amproom": dark charcoal-violet ground (dark in BOTH modes), electric-violet
//    primary, a lime accent, cool light ink + secondary, tight radii, a modern sharp sans
//    display. A cool creative brand, not a themeable-to-white one. ────────────────────────
const amproom = defineTheme({
  name: 'amproom',
  type: { body: face('Inter', 'sans-serif'), head: face('Space Grotesk', 'sans-serif') },
  shape: { selector: '0.125rem', field: '0.125rem', box: '0.25rem', depth: '0' },
  light: {
    // A dark studio even in "light" mode: deep charcoal-violet surfaces, cool bright ink.
    surfaces: [
      'oklch(17% 0.022 292)', // deep charcoal-violet ground
      'oklch(21% 0.026 292)', // raised panel
      'oklch(31% 0.03 292)', // hairline (lifted so borders read on dark)
      'oklch(96% 0.012 292)', // cool bright ink
    ],
    roles: {
      primary: 'oklch(62% 0.23 300)', // electric violet
      secondary: 'oklch(80% 0.035 292)', // cool light lilac-grey (legible on charcoal)
      accent: 'oklch(86% 0.21 128)', // electric lime
      neutral: 'oklch(30% 0.024 292)',
      ...STATUS_ON_DARK,
    },
  },
  dark: {
    // A touch darker still.
    surfaces: [
      'oklch(14% 0.02 292)',
      'oklch(18% 0.024 292)',
      'oklch(27% 0.03 292)',
      'oklch(97% 0.01 292)',
    ],
    roles: {
      primary: 'oklch(66% 0.24 300)',
      secondary: 'oklch(82% 0.035 292)',
      accent: 'oklch(88% 0.22 128)',
      neutral: 'oklch(28% 0.024 292)',
      ...STATUS_ON_DARK,
    },
  },
});
// NOTE: this theme is dark in BOTH modes (a moody studio even in "light"), so both palettes
// take STATUS_ON_DARK — the on-light status set never applies here.

// ── Scheduling — the booking spine (policies, instructors + rooms, the lesson menu) ────────
const hours = (days: number[], startMinute: number, endMinute: number) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

const SCHEDULING = {
  policies: [
    {
      handle: 'lesson-standard',
      name: 'Standard lesson',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [1440, 120],
      policyText:
        'Life happens — just give us 24 hours to reschedule and we’ll move your slot, no charge. We send a reminder the day before and two hours ahead so it never sneaks up on you.',
    },
    {
      handle: 'no-show',
      name: 'Studio-time booking',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [2880, 1440, 120],
      policyText:
        'Production and hour-long sessions hold both an instructor and a room, so we ask for 24 hours’ notice to move them. No deposit — but two no-shows and we’ll ask you to call to rebook so the room stays open for everyone.',
    },
  ],
  resources: [
    {
      handle: 'jules',
      name: 'Jules Kade',
      kind: 'staff',
      skillTags: ['guitar', 'bass', 'songwriting', 'trial'],
      windows: hours([2, 3, 4, 5, 6], 780, 1200), // Tue–Sat 1–8pm
    },
    {
      handle: 'nova',
      name: 'Nova Reyes',
      kind: 'staff',
      skillTags: ['vocals', 'songwriting', 'performance', 'trial'],
      windows: hours([3, 4, 5, 6, 0], 840, 1260), // Wed–Sun 2–9pm
    },
    {
      handle: 'dez',
      name: 'Dez Okonkwo',
      kind: 'staff',
      skillTags: ['production', 'beats', 'mixing', 'trial'],
      windows: hours([1, 2, 3, 4, 5], 720, 1140), // Mon–Fri 12–7pm
    },
    {
      handle: 'live-room-a',
      name: 'Live Room A',
      kind: 'space',
      skillTags: ['studio-room'],
      windows: hours([1, 2, 3, 4, 5, 6, 0], 660, 1290), // open 11am–9:30pm daily
    },
    {
      handle: 'production-suite',
      name: 'The Production Suite',
      kind: 'space',
      skillTags: ['production-suite', 'studio-room'],
      windows: hours([1, 2, 3, 4, 5, 6, 0], 660, 1290), // open 11am–9:30pm daily
    },
  ],
  services: [
    {
      handle: 'trial-lesson',
      name: 'Book a trial lesson',
      description:
        'Your first lesson, on any instrument — meet an instructor, plug in, and play. Thirty minutes to feel the room, talk about where you want to go, and see if we’re your studio. No commitment after.',
      durationMinutes: 30,
      priceCents: 0,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'instructor', kind: 'staff', skillTags: ['trial'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['studio-room'], count: 1 },
      ],
      policyHandle: 'lesson-standard',
    },
    {
      handle: 'guitar-lesson',
      name: 'Guitar lesson',
      description:
        'Electric or acoustic, first chord or first solo. Real technique built around the songs you actually want to play — riffs, rhythm, tone and the theory that makes it click.',
      durationMinutes: 45,
      priceCents: 5500,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'instructor', kind: 'staff', skillTags: ['guitar'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['studio-room'], count: 1 },
      ],
      policyHandle: 'lesson-standard',
    },
    {
      handle: 'vocal-lesson',
      name: 'Vocal lesson',
      description:
        'Find your range and your voice. Breath, pitch, tone and stage confidence — pop, R&B, rock or musical theatre, built around the tracks you love to sing.',
      durationMinutes: 45,
      priceCents: 5500,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'instructor', kind: 'staff', skillTags: ['vocals'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['studio-room'], count: 1 },
      ],
      policyHandle: 'lesson-standard',
    },
    {
      handle: 'bass-lesson',
      name: 'Bass lesson',
      description:
        'Lock in with the drums and hold the whole thing down. Groove, timing, note choice and the pocket — the instrument that makes a band feel good.',
      durationMinutes: 45,
      priceCents: 5500,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'instructor', kind: 'staff', skillTags: ['bass'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['studio-room'], count: 1 },
      ],
      policyHandle: 'lesson-standard',
    },
    {
      handle: 'music-production-lesson',
      name: 'Music production & beat-making',
      description:
        'Build a track from nothing in a real production suite — beats, sampling, arrangement, mixing. Learn your DAW hands-on and walk out with something that sounds like you.',
      durationMinutes: 60,
      priceCents: 7500,
      bufferAfterMin: 10,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'instructor', kind: 'staff', skillTags: ['production'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['production-suite'], count: 1 },
      ],
      policyHandle: 'no-show',
    },
    {
      handle: 'songwriting-session',
      name: 'Songwriting session',
      description:
        'Turn ideas into finished songs. Melody, lyrics, structure and hooks — write with someone who’s released records and knows how to get you unstuck.',
      durationMinutes: 60,
      priceCents: 6500,
      bufferAfterMin: 10,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'instructor', kind: 'staff', skillTags: ['songwriting'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['studio-room'], count: 1 },
      ],
      policyHandle: 'no-show',
    },
    {
      handle: 'performance-coaching',
      name: 'Performance coaching',
      description:
        'Get ready for the stage. Setlists, presence, nerves and working a room — prep for a gig, an audition or an open mic with a coach who’s played them all.',
      durationMinutes: 60,
      priceCents: 6500,
      bufferAfterMin: 10,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'instructor', kind: 'staff', skillTags: ['performance'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['studio-room'], count: 1 },
      ],
      policyHandle: 'no-show',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  typeHero({
    title: 'Plug in. Play the songs you love.',
    sub: 'A modern lessons studio for guitar, vocals, bass, production and songwriting — for teens and adults who want to actually make music, not just practise scales. Start with a trial.',
    primary: { label: 'Book a trial lesson', href: '/book' },
    secondary: { label: 'See lessons', href: '/book' },
    surface: 'primary',
  }),
  featureRow({
    items: [
      {
        title: 'Working-musician instructors',
        body: 'You learn from people who gig, record and release — not from a textbook. Real players who’ve done the thing you’re trying to do.',
      },
      {
        title: 'Real gear, a real studio',
        body: 'Amps, a live room and a full production suite. You play on proper equipment from lesson one, not a practice pad in a closet.',
      },
      {
        title: 'Learn the songs you love',
        body: 'Bring the track that made you want to play. We build the technique and theory around music you actually care about.',
      },
      {
        title: 'Online or in person',
        body: 'Book the room or link up from home — same instructor, same plan. Lessons flex around school, work and everything else.',
      },
    ],
  }),
  serviceMenu({
    heading: 'Lessons',
    intro: 'What we teach, with real prices. Live times, every instructor and the full menu are on the booking page.',
    surface: 'muted',
    columns: 3,
    items: [
      { name: 'Book a trial lesson', priceCents: 0, durationMin: 30, desc: 'Any instrument — meet a teacher and play. Free.' },
      { name: 'Guitar lesson', priceCents: 5500, durationMin: 45, desc: 'Electric or acoustic, riffs to solos.' },
      { name: 'Vocal lesson', priceCents: 5500, durationMin: 45, desc: 'Range, tone and stage confidence.' },
      { name: 'Bass lesson', priceCents: 5500, durationMin: 45, desc: 'Groove, timing and the pocket.' },
      { name: 'Music production & beat-making', priceCents: 7500, durationMin: 60, desc: 'Build a track in the production suite.' },
      { name: 'Songwriting session', priceCents: 6500, durationMin: 60, desc: 'Ideas into finished songs.' },
    ],
    cta: { label: 'See everything & book', href: '/book' },
  }),
  splitFeature({
    image: url(IMG.suite),
    alt: 'A production suite with a mixing desk, monitors and a mic booth',
    heading: 'A studio, not a spare room',
    body: [
      'Amp Room is a proper space — a live room stacked with amps for playing loud, and a full production suite with a mixing desk, studio monitors and a vocal booth for making records.',
      'It means your production lesson happens on the same gear the pros use, and your first take can end up being a real recording. You’re making music here, not just taking a class.',
    ],
    cta: { label: 'Book studio time', href: '/book' },
  }),
  teamRow({
    heading: 'Your instructors',
    intro: 'Book by name — the same person every week, someone who plays the music you want to make.',
    members: [
      { name: 'Jules Kade', role: 'Guitar · Bass · Songwriting', image: url(IMG.jules), alt: 'Jules Kade, guitar, bass & songwriting instructor', bio: 'Toured guitarist and session player. Gets beginners playing real songs fast, and pushes players who’ve plateaued.' },
      { name: 'Nova Reyes', role: 'Vocals · Songwriting · Performance', image: url(IMG.nova), alt: 'Nova Reyes, vocals, songwriting & performance coach', bio: 'Released artist and vocal coach. Builds range and confidence, then gets you stage-ready for the gig.' },
      { name: 'Dez Okonkwo', role: 'Production · Beats · Mixing', image: url(IMG.dez), alt: 'Dez Okonkwo, music production & beat-making instructor', bio: 'Producer and beatmaker with credits across hip-hop and pop. Teaches you to finish tracks, not just start them.' },
    ],
  }),
  testimonial({
    quote: 'I came in barely able to play a chord and walked out six months later with a song I actually recorded in their studio. The instructors treat you like a musician from day one.',
    attribution: 'Sam, student since last autumn',
    surface: 'primary',
  }),
  bookingCta({
    title: 'Your first lesson is free',
    sub: 'Pick an instrument, choose a time, meet your instructor. The trial’s on us — see where it goes.',
    cta: { label: 'Book a trial lesson', href: '/book' },
  }),
];

const BOOK_INTRO = [
  photoHero({
    image: url(IMG.room),
    alt: 'A live room with amps, a drum kit and warm stage lighting',
    title: 'Book a lesson',
    sub: 'Choose a lesson to see prices and live times, then pick your instructor and slot. New here? Start with the free trial.',
    primary: { label: 'See lessons below', href: '/book' },
    overlay: 'darker',
    align: 'start',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.room),
    alt: 'A live room with amps, a drum kit and warm stage lighting',
    heading: 'About Amp Room',
    body: [
      'We started Amp Room because the way most people are taught music is backwards — years of scales before you’re allowed to play anything you like. So we flipped it: you play real songs from lesson one, and the technique comes with them.',
      'It’s a contemporary studio for guitar, vocals, bass, production and songwriting — teens and adults, total beginners and returning players. Real gear, working-musician teachers, and a room that makes you want to keep showing up.',
    ],
    cta: { label: 'Book a trial lesson', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'How we teach',
    items: [
      { title: 'Songs first', body: 'Bring what you love and we build the skills around it. You’ll be playing real music long before it stops feeling like work.' },
      { title: 'One instructor, yours', body: 'Book the same teacher each week. They learn how you learn, track your progress, and plan every lesson around where you’re headed.' },
      { title: 'Made to be heard', body: 'Recitals, open mics and studio recordings. We give you reasons to play in front of people, because that’s where it gets real.' },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Find the studio',
    address: ['Amp Room', '88 Sundry Street', 'Unit 4 · Austin, TX 78702'],
    mapLocation: '88 Sundry Street, Austin, TX 78702',
    hours: [
      { day: 'Monday – Friday', time: '11:00 – 21:30' },
      { day: 'Saturday', time: '11:00 – 20:00' },
      { day: 'Sunday', time: '12:00 – 18:00' },
      { day: 'Online lessons', time: 'By appointment' },
    ],
  }),
  bookingCta({
    title: 'Ready to play?',
    sub: 'Book your free trial online and see live times — pick an instrument, pick a slot, we’ll take it from there.',
    surface: 'muted',
    cta: { label: 'Book a trial lesson', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-music-studio',
  name: 'Music Studio (Contemporary)',
  summary:
    'A cool, creative music-lessons studio site — a dark charcoal-violet palette, an electric-violet primary and a modern sharp sans. Installs a working online booking flow: a free trial lesson plus guitar, vocals, bass, production, songwriting and performance lessons; three working-musician instructors booked by name; and two studio rooms — one a production suite — as bookable resources. Ships as "Amp Room", a contemporary lessons studio.',
  tagline: 'A modern, creative template for music-lessons studios — book trials online from day one.',
  industry: 'Music lessons',
  sortWeight: 49,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'Amp Room', tagline: 'Plug in. Play the songs you love.' },
  theme: amproom,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Amp Room — contemporary music lessons',
      description:
        'Amp Room is a modern music-lessons studio for guitar, vocals, bass, production and songwriting — teens and adults, beginners to gigging players. Book a free trial lesson online.',
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
