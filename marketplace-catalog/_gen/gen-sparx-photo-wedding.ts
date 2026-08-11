// sparx-photo-wedding — "Golden Hour Studio", a film-inspired WEDDING photographer.
//
// The warm, romantic, imagery-led sibling of the service-template family: soft gold and
// cream over dusty rose, an elegant serif display over a humanist sans, and golden-hour
// photography carrying every page. Deliberately the OPPOSITE of the bright, modern
// family/portrait studio template — this one is the warm, film, wedding & engagement lane.
// Same booking spine as the salons and barbershops (a live /book with a real service menu
// and bookable staff), a different business: the "session" you reserve is a consult or a
// shoot with a named photographer, and a deposit holds a wedding date.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-photo-wedding.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-photo-wedding/**" \
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
  hero: 'photo-wedding-hero',
  story: 'photo-wedding-story',
  rowan: 'photo-wedding-rowan',
  lena: 'photo-wedding-lena',
  mateo: 'photo-wedding-mateo',
  work1: 'photo-wedding-work1',
  work2: 'photo-wedding-work2',
  work3: 'photo-wedding-work3',
  work4: 'photo-wedding-work4',
  work5: 'photo-wedding-work5',
  work6: 'photo-wedding-work6',
} as const;

const PHOTO: Record<string, string> = {
  "goldenhour-hero": "https://images.unsplash.com/photo-1566813142858-99f1e35e333a?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d2VkZGluZyUyMGNvdXBsZSUyMGdvbGRlbiUyMGhvdXJ8ZW58MHwwfHx8MTc4NjM5MDYxN3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "goldenhour-story": "https://images.unsplash.com/photo-1488684430052-f2d92fb178c2?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d2VkZGluZyUyMHBob3RvZ3JhcGhlciUyMGNhbWVyYXxlbnwwfDB8fHwxNzg2MzkwNjIwfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "goldenhour-rowan": "https://images.unsplash.com/photo-1475274226786-e636f48a5645?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGhvdG9ncmFwaGVyJTIwcG9ydHJhaXQlMjBtYW58ZW58MHwwfHx8MTc4NjM5MDYyM3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "goldenhour-lena": "https://images.unsplash.com/photo-1541516160071-4bb0c5af65ba?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjBwaG90b2dyYXBoZXIlMjBwb3J0cmFpdHxlbnwwfDB8fHwxNzg2MzkwNjI2fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "goldenhour-mateo": "https://images.unsplash.com/photo-1542992933-ce75d0187ec1?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGhvdG9ncmFwaGVyJTIwcG9ydHJhaXR8ZW58MHwwfHx8MTc4NjM5MDYyOXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "goldenhour-work1": "https://images.unsplash.com/photo-1519741497674-611481863552?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YnJpZGUlMjBncm9vbSUyMHdlZGRpbmd8ZW58MHwwfHx8MTc4NjM5MDYzMnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "goldenhour-work2": "https://images.unsplash.com/photo-1606800052052-a08af7148866?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d2VkZGluZyUyMGNlcmVtb255fGVufDB8MHx8fDE3ODYzOTA2MzV8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "goldenhour-work3": "https://images.unsplash.com/photo-1542460533-50ac46fb13d7?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZW5nYWdlbWVudCUyMGNvdXBsZSUyMHN1bnNldHxlbnwwfDB8fHwxNzg2MzkwNjM4fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "goldenhour-work4": "https://images.unsplash.com/photo-1550368566-f9cc32d7392d?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d2VkZGluZyUyMGRldGFpbHMlMjByaW5nc3xlbnwwfDB8fHwxNzg2MzkwNjQxfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "goldenhour-work5": "https://images.unsplash.com/photo-1527529482837-4698179dc6ce?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d2VkZGluZyUyMHJlY2VwdGlvbiUyMGNlbGVicmF0aW9ufGVufDB8MHx8fDE3ODYzOTA2NDR8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "goldenhour-work6": "https://images.unsplash.com/photo-1665960211264-5e0a7112bacd?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YnJpZGUlMjBwb3J0cmFpdHxlbnwwfDB8fHwxNzg2MzkwNjQ3fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
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
    url: src('goldenhour-hero'),
    alt: 'A couple embracing in warm golden-hour light in a summer field',
  },
  {
    id: IMG.story,
    url: src('goldenhour-story'),
    alt: 'A bride and groom laughing together, shot on film',
  },
  {
    id: IMG.rowan,
    url: src('goldenhour-rowan'),
    alt: 'Rowan Ellis, lead wedding photographer',
  },
  { id: IMG.lena, url: src('goldenhour-lena'), alt: 'Lena Marsh, photographer' },
  { id: IMG.mateo, url: src('goldenhour-mateo'), alt: 'Mateo Reyes, photographer' },
  { id: IMG.work1, url: src('goldenhour-work1'), alt: 'A first look at sunset' },
  { id: IMG.work2, url: src('goldenhour-work2'), alt: 'An intimate elopement in the hills' },
  { id: IMG.work3, url: src('goldenhour-work3'), alt: 'A candid moment on the dance floor' },
  { id: IMG.work4, url: src('goldenhour-work4'), alt: 'An engagement walk through tall grass' },
  { id: IMG.work5, url: src('goldenhour-work5'), alt: 'Wedding details laid out in soft morning light' },
  { id: IMG.work6, url: src('goldenhour-work6'), alt: 'The couple beneath string lights at dusk' },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-photo-wedding: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "goldenhour": cream ground, soft-gold primary, dusty-rose accent, dark slate ─
const goldenhour = defineTheme({
  name: 'goldenhour',
  type: { body: face('Inter', 'sans-serif'), head: face('Cormorant Garamond', 'serif') },
  shape: { selector: '0.5rem', field: '0.5rem', box: '0.75rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(97% 0.012 85)', // warm cream
      'oklch(94% 0.016 80)', // soft sand
      'oklch(89% 0.02 75)', // hairline
      'oklch(24% 0.014 55)', // deep warm slate ink
    ],
    roles: {
      primary: 'oklch(68% 0.085 68)', // soft gold / amber
      secondary: 'oklch(38% 0.02 55)', // dark warm slate (readable micro-labels)
      accent: 'oklch(70% 0.05 28)', // dusty rose
      neutral: 'oklch(26% 0.012 55)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(22% 0.012 55)',
      'oklch(18% 0.01 55)',
      'oklch(14% 0.008 55)',
      'oklch(95% 0.01 85)',
    ],
    roles: {
      primary: 'oklch(79% 0.09 72)',
      secondary: 'oklch(76% 0.014 70)',
      accent: 'oklch(77% 0.055 30)',
      neutral: 'oklch(84% 0.012 70)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the booking spine (policies, photographers + hours, the consult menu) ──
const hours = (days: number[], startMinute: number, endMinute: number) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

const SCHEDULING = {
  policies: [
    {
      handle: 'photo-standard',
      name: 'Standard booking',
      depositType: 'none',
      cancellationWindowHours: 48,
      reminderOffsetsMin: [2880, 1440],
      policyText:
        'Please give us at least 48 hours’ notice to change or cancel a consultation. We’ll send a reminder two days and one day before.',
    },
    {
      handle: 'date-deposit',
      name: 'Date-reservation deposit',
      depositType: 'deposit',
      depositAmountCents: 50000,
      cancellationWindowHours: 168,
      reminderOffsetsMin: [10080, 2880, 1440],
      policyText:
        'A $500 deposit reserves your date and comes off your collection total. Reschedule with a week’s notice and it carries over to your new date.',
    },
  ],
  resources: [
    {
      handle: 'rowan',
      name: 'Rowan Ellis',
      kind: 'staff',
      skillTags: ['wedding', 'engagement', 'elopement', 'film'],
      windows: hours([3, 4, 5, 6, 0], 540, 1140), // Wed–Sun 9–7
    },
    {
      handle: 'lena',
      name: 'Lena Marsh',
      kind: 'staff',
      skillTags: ['wedding', 'portrait', 'film', 'bridal'],
      windows: hours([2, 3, 4, 5, 6], 600, 1080), // Tue–Sat 10–6
    },
    {
      handle: 'mateo',
      name: 'Mateo Reyes',
      kind: 'staff',
      skillTags: ['wedding', 'engagement', 'album'],
      windows: hours([4, 5, 6, 0], 600, 1200), // Thu–Sun 10–8
    },
  ],
  services: [
    {
      handle: 'consultation',
      name: 'Consultation',
      description:
        'A relaxed, no-pressure call or coffee to talk through your day, your story and how we work. Always free.',
      durationMinutes: 30,
      priceCents: 0,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'photographer', kind: 'staff', skillTags: ['wedding'], count: 1 },
      ],
      policyHandle: 'photo-standard',
    },
    {
      handle: 'engagement-session',
      name: 'Engagement session',
      description:
        'A golden-hour hour-and-a-half together — a warm-up in front of the camera and photographs you’ll actually use.',
      durationMinutes: 90,
      priceCents: 45000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'photographer', kind: 'staff', skillTags: ['engagement'], count: 1 },
      ],
      policyHandle: 'date-deposit',
    },
    {
      handle: 'wedding-collection-consult',
      name: 'Wedding collection consult',
      description:
        'Sit with us to shape a full-day collection around your plans, your venue and the moments that matter most.',
      durationMinutes: 60,
      priceCents: 0,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'photographer', kind: 'staff', skillTags: ['wedding'], count: 1 },
      ],
      policyHandle: 'photo-standard',
    },
    {
      handle: 'elopement-session',
      name: 'Elopement session',
      description:
        'Just the two of you, somewhere beautiful, unhurried. Half a day of quiet, film-led coverage of your elopement.',
      durationMinutes: 120,
      priceCents: 120000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'photographer', kind: 'staff', skillTags: ['elopement'], count: 1 },
      ],
      policyHandle: 'date-deposit',
    },
    {
      handle: 'bridal-session',
      name: 'Bridal session',
      description:
        'A slow, portrait-led morning in your gown — a trial run and a set of timeless images before the day itself.',
      durationMinutes: 90,
      priceCents: 55000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'photographer', kind: 'staff', skillTags: ['bridal'], count: 1 },
      ],
      policyHandle: 'date-deposit',
    },
    {
      handle: 'full-day-wedding-consult',
      name: 'Full-day wedding consult',
      description:
        'A planning session for the whole wedding day — timeline, light and coverage, so nothing is left to chance.',
      durationMinutes: 45,
      priceCents: 0,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'photographer', kind: 'staff', skillTags: ['wedding'], count: 1 },
      ],
      policyHandle: 'photo-standard',
    },
    {
      handle: 'album-design-consult',
      name: 'Album design consult',
      description:
        'Come choose your favourites and we’ll design a hand-bound heirloom album together, print by print.',
      durationMinutes: 45,
      priceCents: 0,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'photographer', kind: 'staff', skillTags: ['album'], count: 1 },
      ],
      policyHandle: 'photo-standard',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  photoHero({
    image: url(IMG.hero),
    alt: 'A couple embracing in warm golden-hour light in a summer field',
    title: 'Your love, in the golden hour',
    sub: 'Warm, film-inspired wedding and engagement photography — the quiet in-between moments, the way the day actually felt, kept for good.',
    primary: { label: 'Book a consultation', href: '/book' },
    secondary: { label: 'See the work', href: '/book' },
    overlay: 'dark',
  }),
  featureRow({
    items: [
      {
        title: 'Film and digital, together',
        body: 'We shoot both — the softness and grain of film for the moments that matter, digital for the light that won’t wait.',
      },
      {
        title: 'Unhurried and candid',
        body: 'Very little posing. We stay close, keep quiet, and let the day unfold — so what you get back is real, not arranged.',
      },
      {
        title: 'Full-day coverage',
        body: 'From the first nervous morning look to the last song, we’re there for all of it — no clock-watching, no gaps.',
      },
      {
        title: 'Heirloom albums',
        body: 'Your photographs deserve more than a hard drive. We design hand-bound albums made to be passed down.',
      },
    ],
  }),
  serviceMenu({
    heading: 'Ways to begin',
    intro: 'Every couple starts with a free consultation. Choose what fits, and we’ll take it from there — live availability is on the booking page.',
    surface: 'muted',
    columns: 2,
    items: [
      {
        name: 'Consultation',
        priceCents: 0,
        durationMin: 30,
        desc: 'A free, relaxed talk about your day and how we work.',
      },
      {
        name: 'Engagement session',
        priceCents: 45000,
        durationMin: 90,
        desc: 'A golden-hour shoot and a warm-up before the wedding.',
      },
      {
        name: 'Wedding collection consult',
        priceCents: 0,
        durationMin: 60,
        desc: 'Shape a full-day collection around your plans.',
      },
      {
        name: 'Elopement session',
        priceCents: 120000,
        durationMin: 120,
        desc: 'Half a day of quiet coverage, just the two of you.',
      },
    ],
    cta: { label: 'See everything & book', href: '/book' },
  }),
  galleryStrip({
    heading: 'Recent weddings',
    surface: 'base',
    columns: 3,
    images: [
      { src: url(IMG.work1), alt: 'A first look at sunset' },
      { src: url(IMG.work2), alt: 'An intimate elopement in the hills' },
      { src: url(IMG.work3), alt: 'A candid moment on the dance floor' },
      { src: url(IMG.work4), alt: 'An engagement walk through tall grass' },
      { src: url(IMG.work5), alt: 'Wedding details laid out in soft morning light' },
      { src: url(IMG.work6), alt: 'The couple beneath string lights at dusk' },
    ],
  }),
  splitFeature({
    image: url(IMG.story),
    alt: 'A bride and groom laughing together, shot on film',
    heading: 'We photograph the story, not just the schedule',
    body: [
      'A wedding isn’t a shot list. It’s your grandmother’s hand on your shoulder, the look you share before the doors open, the friend who can’t stop laughing during the toast.',
      'So we work gently and stay close, following the day as it happens. You forget we’re there — and months later you open the gallery and feel it all again, exactly as it was.',
    ],
    cta: { label: 'Book a consultation', href: '/book' },
  }),
  teamRow({
    heading: 'The photographers',
    intro: 'Book by name — you’ll meet your photographer at the consultation and they’ll be with you on the day.',
    members: [
      {
        name: 'Rowan Ellis',
        role: 'Lead photographer',
        image: url(IMG.rowan),
        alt: 'Rowan Ellis, lead wedding photographer',
        bio: 'Founded the studio on a love of film and last light. Rowan leads full-day weddings and elopements.',
      },
      {
        name: 'Lena Marsh',
        role: 'Photographer',
        image: url(IMG.lena),
        alt: 'Lena Marsh, photographer',
        bio: 'Portraits and bridal sessions, and a gift for making anyone feel at ease in front of the lens.',
      },
      {
        name: 'Mateo Reyes',
        role: 'Photographer',
        image: url(IMG.mateo),
        alt: 'Mateo Reyes, photographer',
        bio: 'Engagement shoots and the album room — he’ll help you turn a gallery into something you hold.',
      },
    ],
  }),
  testimonial({
    quote: 'We barely noticed the camera all day, and then the photos arrived and we both cried. It’s our whole wedding — the light, the nerves, the joy — exactly how it felt.',
    attribution: 'Amara & Josh, married summer 2025',
    surface: 'muted',
  }),
  bookingCta({
    title: 'Let’s reserve your date',
    sub: 'Start with a free consultation. Tell us about your day, meet your photographer, and see live availability — it takes about a minute.',
    cta: { label: 'Book a consultation', href: '/book' },
  }),
];

const BOOK_INTRO = [
  photoHero({
    image: url(IMG.work1),
    alt: 'A first look at sunset',
    title: 'Book your session',
    sub: 'Every couple starts with a free consultation. Choose a session or consult below to see prices and live availability, then pick your photographer and time.',
    primary: { label: 'See sessions below', href: '/book' },
    overlay: 'darker',
    align: 'start',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.hero),
    alt: 'A couple embracing in warm golden-hour light in a summer field',
    heading: 'About Golden Hour Studio',
    body: [
      'We started Golden Hour Studio because we believe a wedding deserves to be remembered the way it was lived — warm, a little imperfect, and full of feeling. Not stiff, not staged.',
      'We shoot on film and digital both, work quietly, and chase the last good light of the day. What you get back isn’t a highlight reel — it’s your story, honestly told, made to outlast us all.',
    ],
    cta: { label: 'Book a consultation', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'How we work',
    items: [
      {
        title: 'A consultation first',
        body: 'Always. We meet, we listen, and we make sure we’re the right fit before anyone books a thing.',
      },
      {
        title: 'Present, not intrusive',
        body: 'We move with the day rather than direct it, so your photographs feel like memories, not poses.',
      },
      {
        title: 'Yours to hold',
        body: 'Beautifully edited galleries, print-ready files, and hand-bound albums designed with you.',
      },
    ],
  }),
  galleryStrip({
    heading: 'A little of our work',
    surface: 'base',
    columns: 3,
    images: [
      { src: url(IMG.work4), alt: 'An engagement walk through tall grass' },
      { src: url(IMG.work2), alt: 'An intimate elopement in the hills' },
      { src: url(IMG.work6), alt: 'The couple beneath string lights at dusk' },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Come by the studio',
    address: ['Golden Hour Studio', '54 Marigold Lane', 'Studio B · Asheville, NC 28801'],
    mapLocation: '54 Marigold Lane, Asheville, NC 28801',
    hours: [
      { day: 'Tuesday – Friday', time: '10:00 – 6:00' },
      { day: 'Saturday', time: 'By appointment' },
      { day: 'Sunday', time: 'By appointment' },
      { day: 'Monday', time: 'Closed' },
    ],
  }),
  bookingCta({
    title: 'Rather book than call?',
    sub: 'Start with a free consultation online — pick a time that suits you and we’ll see you soon.',
    surface: 'muted',
    cta: { label: 'Book a consultation', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-photo-wedding',
  name: 'sparx — Wedding Photography',
  summary:
    'An imagery-led wedding & engagement photography site — a warm, film-inspired palette of soft gold, cream and dusty rose over an elegant serif display, with golden-hour photography carrying every page. Installs a working booking flow: free consultations and paid sessions booked online, three photographers you reserve by name with their own hours, and a deposit policy for holding a wedding date. Ships as "Golden Hour Studio".',
  tagline:
    'A warm, film-inspired template for wedding photographers — book consultations online from day one.',
  industry: 'Photography',
  sortWeight: 60,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'Golden Hour Studio', tagline: 'Your love, in the golden hour.' },
  theme: goldenhour,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Golden Hour Studio — film-inspired wedding photography',
      description:
        'Golden Hour Studio is a warm, film-inspired wedding and engagement photographer. Book a free consultation with your photographer online.',
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
